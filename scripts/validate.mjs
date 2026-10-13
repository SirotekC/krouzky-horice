// Validace dat: schémata, unikátnost id, referenční integrita a logické kontroly.
// Použití: node scripts/validate.mjs   (exit kód 1 při chybě)

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { cisloDne, dnesPraha } from '../site/js/registration.js';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STARI_VAROVANI_DNI = 90;

const META_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mesto', 'aktualizovano', 'verze_schematu'],
  properties: {
    mesto: { type: 'string', minLength: 1 },
    aktualizovano: { type: 'string', format: 'date' },
    verze_schematu: { type: 'integer', minimum: 1 },
  },
};

async function nactiJson(relativniCesta) {
  const text = await readFile(path.join(KOREN, relativniCesta), 'utf8');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${relativniCesta}: neplatný JSON – ${e.message}`);
  }
}

/** Vytvoří zkompilované validátory pro organizace, aktivity a meta. */
export async function vytvorValidatory() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const [schemaOrganizace, schemaAktivity] = await Promise.all([
    nactiJson('schema/organizace.schema.json'),
    nactiJson('schema/aktivity.schema.json'),
  ]);
  return {
    organizace: ajv.compile(schemaOrganizace),
    aktivity: ajv.compile(schemaAktivity),
    meta: ajv.compile(META_SCHEMA),
    schemaAktivity,
  };
}

/** Převede cestu z ajv (`/3/prihlaska/do`) na čitelnou (`aktivity[3].prihlaska.do`). */
export function citelnaCesta(soubor, instancePath) {
  const casti = instancePath.split('/').filter(Boolean);
  let vysledek = soubor;
  for (const cast of casti) vysledek += /^\d+$/.test(cast) ? `[${cast}]` : `.${cast}`;
  return vysledek;
}

function popisChybyAjv(soubor, chyba) {
  let cesta = citelnaCesta(soubor, chyba.instancePath);
  let zprava = chyba.message;
  if (chyba.keyword === 'additionalProperties') {
    cesta += `.${chyba.params.additionalProperty}`;
    zprava = 'neznámé pole (překlep v názvu?)';
  } else if (chyba.keyword === 'required') {
    zprava = `chybí povinné pole „${chyba.params.missingProperty}“`;
  } else if (chyba.keyword === 'enum') {
    zprava = `musí být jedna z hodnot: ${chyba.params.allowedValues.join(', ')}`;
  }
  return `${cesta}: ${zprava}`;
}

/**
 * Logické kontroly nad daty, která už prošla schématem.
 * @returns {{ chyby: string[], varovani: string[] }}
 */
export function zkontrolujData({ organizace, aktivity, kategorieSchema, kategorieUi, skupinyUi = null, dnes }) {
  const chyby = [];
  const varovani = [];

  const zkontrolujUnikatnost = (soubor, polozky) => {
    const videne = new Map();
    polozky.forEach((p, i) => {
      if (videne.has(p.id)) chyby.push(`${soubor}[${i}].id: duplicitní id „${p.id}“ (už je u ${soubor}[${videne.get(p.id)}])`);
      else videne.set(p.id, i);
    });
  };
  zkontrolujUnikatnost('organizace', organizace);
  zkontrolujUnikatnost('aktivity', aktivity);

  const zkontrolujOvereno = (soubor, polozky) => {
    polozky.forEach((p, i) => {
      const stari = cisloDne(dnes) - cisloDne(p.overeno);
      if (stari < 0) chyby.push(`${soubor}[${i}].overeno: datum ${p.overeno} je v budoucnosti`);
      else if (stari > STARI_VAROVANI_DNI) varovani.push(`${soubor}[${i}].overeno: údaje jsou ${stari} dní staré (${p.id})`);
    });
  };
  zkontrolujOvereno('organizace', organizace);
  zkontrolujOvereno('aktivity', aktivity);

  const idOrganizaci = new Set(organizace.map((o) => o.id));
  aktivity.forEach((a, i) => {
    const cesta = `aktivity[${i}]`;
    if (!idOrganizaci.has(a.organizace_id)) {
      chyby.push(`${cesta}.organizace_id: organizace „${a.organizace_id}“ neexistuje v organizace.json (${a.id})`);
    }
    if (a.vek_od != null && a.vek_do != null && a.vek_od > a.vek_do) {
      chyby.push(`${cesta}.vek_do: vek_do (${a.vek_do}) je menší než vek_od (${a.vek_od}) (${a.id})`);
    }
    const rozvrh = a.terminy?.rozvrh;
    if (rozvrh?.length && a.terminy.dny) {
      const vRozvrhu = new Set(rozvrh.map((r) => r.den));
      const dny = new Set(a.terminy.dny);
      if (vRozvrhu.size !== dny.size || [...dny].some((d) => !vRozvrhu.has(d))) {
        chyby.push(`${cesta}.terminy.dny: dny [${[...dny]}] neodpovídají rozvrhu [${[...vRozvrhu]}] (${a.id})`);
      }
    }
    const { od, do: doData } = a.prihlaska;
    if (od && doData && cisloDne(od) > cisloDne(doData)) {
      chyby.push(`${cesta}.prihlaska.do: konec přihlášek (${doData}) je před začátkem (${od}) (${a.id})`);
    }
  });

  const vSchematu = new Set(kategorieSchema);
  const vUi = new Set(kategorieUi);
  for (const k of vSchematu) if (!vUi.has(k)) chyby.push(`kategorie: „${k}“ je ve schématu, ale chybí v site/js/data.js`);
  for (const k of vUi) if (!vSchematu.has(k)) chyby.push(`kategorie: „${k}“ je v site/js/data.js, ale chybí ve schématu`);

  if (skupinyUi) {
    const vSkupinach = new Map();
    for (const [skupina, { kategorie }] of Object.entries(skupinyUi)) {
      for (const k of kategorie) {
        if (!vUi.has(k)) chyby.push(`skupiny kategorií: „${k}“ ve skupině „${skupina}“ není v číselníku kategorií`);
        else if (vSkupinach.has(k)) chyby.push(`skupiny kategorií: „${k}“ je ve skupině „${vSkupinach.get(k)}“ i „${skupina}“`);
        else vSkupinach.set(k, skupina);
      }
    }
    for (const k of vUi) if (!vSkupinach.has(k)) chyby.push(`skupiny kategorií: „${k}“ nepatří do žádné skupiny`);
  }

  return { chyby, varovani };
}

/** Spustí celou validaci nad soubory v repozitáři. */
export async function validuj({ dnes = dnesPraha() } = {}) {
  const validatory = await vytvorValidatory();
  const [organizace, aktivity, meta] = await Promise.all([
    nactiJson('site/data/organizace.json'),
    nactiJson('site/data/aktivity.json'),
    nactiJson('site/data/meta.json'),
  ]);

  const chyby = [];
  for (const [soubor, validator, data] of [
    ['organizace', validatory.organizace, organizace],
    ['aktivity', validatory.aktivity, aktivity],
    ['meta', validatory.meta, meta],
  ]) {
    if (!validator(data)) chyby.push(...validator.errors.map((e) => popisChybyAjv(soubor, e)));
  }
  // Logické kontroly mají smysl jen nad daty se správnou strukturou.
  if (chyby.length) return { chyby, varovani: [] };

  const { KATEGORIE, SKUPINY_KATEGORII } = await import(pathToFileURL(path.join(KOREN, 'site/js/data.js')).href);
  return zkontrolujData({
    organizace,
    aktivity,
    kategorieSchema: validatory.schemaAktivity.$defs.kategorie.enum,
    kategorieUi: Object.keys(KATEGORIE),
    skupinyUi: SKUPINY_KATEGORII,
    dnes,
  });
}

async function main() {
  let vysledek;
  try {
    vysledek = await validuj();
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  }
  const { chyby, varovani } = vysledek;
  for (const v of varovani) console.warn(`⚠ ${v}`);
  for (const c of chyby) console.error(`✖ ${c}`);
  if (chyby.length) {
    const n = chyby.length;
    console.error(`\nValidace selhala: ${n} ${n === 1 ? 'chyba' : n <= 4 ? 'chyby' : 'chyb'}.`);
    process.exit(1);
  }
  console.log(`✔ Data jsou v pořádku.${varovani.length ? ` Varování: ${varovani.length}.` : ''}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

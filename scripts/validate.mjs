// Validace dat: schémata, unikátnost id, referenční integrita a logické kontroly.
// Použití: node scripts/validate.mjs   (exit kód 1 při chybě)

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { cisloDne, dnesPraha } from '../site/js/registration.js';
import { normalizujUrl } from '../site/js/data.js';

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
  const [schemaSpolecne, schemaOrganizace, schemaAktivity, schemaAktivityDospeli, schemaKontrola] = await Promise.all([
    nactiJson('schema/spolecne.schema.json'),
    nactiJson('schema/organizace.schema.json'),
    nactiJson('schema/aktivity.schema.json'),
    nactiJson('schema/aktivity-dospeli.schema.json'),
    nactiJson('schema/kontrola.schema.json'),
  ]);
  // Na společné definice (místo, termíny, cena, přihláška) odkazují schémata aktivit přes `$ref`.
  ajv.addSchema(schemaSpolecne);
  return {
    organizace: ajv.compile(schemaOrganizace),
    aktivity: ajv.compile(schemaAktivity),
    aktivityDospeli: ajv.compile(schemaAktivityDospeli),
    meta: ajv.compile(META_SCHEMA),
    kontrola: ajv.compile(schemaKontrola),
    schemaAktivity,
    schemaAktivityDospeli,
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

/** Kontrola, že číselník kategorií v UI odpovídá schématu a každá kategorie je právě v jedné skupině. */
function zkontrolujCiselnik(chyby, { nazev, kategorieSchema, kategorieUi, skupinyUi }) {
  const vSchematu = new Set(kategorieSchema);
  const vUi = new Set(kategorieUi);
  for (const k of vSchematu) if (!vUi.has(k)) chyby.push(`kategorie${nazev}: „${k}“ je ve schématu, ale chybí v site/js/data.js`);
  for (const k of vUi) if (!vSchematu.has(k)) chyby.push(`kategorie${nazev}: „${k}“ je v site/js/data.js, ale chybí ve schématu`);

  if (skupinyUi) {
    const vSkupinach = new Map();
    for (const [skupina, { kategorie }] of Object.entries(skupinyUi)) {
      for (const k of kategorie) {
        if (!vUi.has(k)) chyby.push(`skupiny kategorií${nazev}: „${k}“ ve skupině „${skupina}“ není v číselníku kategorií`);
        else if (vSkupinach.has(k)) chyby.push(`skupiny kategorií${nazev}: „${k}“ je ve skupině „${vSkupinach.get(k)}“ i „${skupina}“`);
        else vSkupinach.set(k, skupina);
      }
    }
    for (const k of vUi) if (!vSkupinach.has(k)) chyby.push(`skupiny kategorií${nazev}: „${k}“ nepatří do žádné skupiny`);
  }
}

/**
 * Logické kontroly nad daty, která už prošla schématem. Aktivity pro dospělé (`aktivityDospeli`)
 * se kontrolují stejně jako dětské; číselník dospělých jen tehdy, když je zadaný `kategorieUiDospeli`.
 * @returns {{ chyby: string[], varovani: string[] }}
 */
export function zkontrolujData({
  organizace,
  aktivity,
  kategorieSchema,
  kategorieUi,
  skupinyUi = null,
  aktivityDospeli = [],
  kategorieSchemaDospeli = null,
  kategorieUiDospeli = null,
  skupinyUiDospeli = null,
  kontrola = null,
  dnes,
}) {
  const chyby = [];
  const varovani = [];

  /** Id musí být unikátní v rámci všech zadaných seznamů (aktivity obou sekcí sdílejí odkazy na detail). */
  const zkontrolujUnikatnost = (...seznamy) => {
    const videne = new Map();
    for (const [soubor, polozky] of seznamy) {
      polozky.forEach((p, i) => {
        const cesta = `${soubor}[${i}]`;
        if (videne.has(p.id)) chyby.push(`${cesta}.id: duplicitní id „${p.id}“ (už je u ${videne.get(p.id)})`);
        else videne.set(p.id, cesta);
      });
    }
  };
  zkontrolujUnikatnost(['organizace', organizace]);
  zkontrolujUnikatnost(['aktivity', aktivity], ['dospeli', aktivityDospeli]);

  const zkontrolujOvereno = (soubor, polozky) => {
    polozky.forEach((p, i) => {
      const stari = cisloDne(dnes) - cisloDne(p.overeno);
      if (stari < 0) chyby.push(`${soubor}[${i}].overeno: datum ${p.overeno} je v budoucnosti`);
      else if (stari > STARI_VAROVANI_DNI) varovani.push(`${soubor}[${i}].overeno: údaje jsou ${stari} dní staré (${p.id})`);
    });
  };
  zkontrolujOvereno('organizace', organizace);
  zkontrolujOvereno('aktivity', aktivity);
  zkontrolujOvereno('dospeli', aktivityDospeli);

  const idOrganizaci = new Set(organizace.map((o) => o.id));
  const zkontrolujAktivitu = (soubor) => (a, i) => {
    const cesta = `${soubor}[${i}]`;
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
    const kapacita = a.prihlaska.kapacita;
    if (kapacita?.volna_mista != null && kapacita.stav !== 'posledni') {
      chyby.push(`${cesta}.prihlaska.kapacita.volna_mista: počet míst patří jen ke stavu „posledni“ (${a.id})`);
    }
  };
  aktivity.forEach(zkontrolujAktivitu('aktivity'));
  aktivityDospeli.forEach(zkontrolujAktivitu('dospeli'));

  zkontrolujCiselnik(chyby, { nazev: '', kategorieSchema, kategorieUi, skupinyUi });
  if (kategorieUiDospeli) {
    zkontrolujCiselnik(chyby, {
      nazev: ' dospělých',
      kategorieSchema: kategorieSchemaDospeli,
      kategorieUi: kategorieUiDospeli,
      skupinyUi: skupinyUiDospeli,
    });

    // Aktivita zobrazená i v druhé sekci se tam musí dát najít filtrem zaměření.
    const zkontrolujDruhouSekci = (soubor, seznam, priznak, ciselnik, nazevCiselniku) => {
      const platne = new Set(ciselnik);
      seznam.forEach((a, i) => {
        if (!a[priznak]) return;
        for (const k of a.kategorie ?? []) {
          if (!platne.has(k)) chyby.push(`${soubor}[${i}].kategorie: „${k}“ není v číselníku ${nazevCiselniku} (${priznak}) (${a.id})`);
        }
      });
    };
    zkontrolujDruhouSekci('aktivity', aktivity, 'i_pro_dospele', kategorieUiDospeli, 'dospělých');
    zkontrolujDruhouSekci('dospeli', aktivityDospeli, 'i_pro_deti', kategorieUi, 'dětí');
  }

  if (kontrola) {
    // Sledované jsou všechny URL z dat (stejně jako v scripts/monitor/seznam-url.mjs).
    const zdrojeAktivit = new Set(
      [
        ...[...aktivity, ...aktivityDospeli].flatMap((a) => [a.zdroj_url, a.prihlaska?.odkaz]),
        ...organizace.flatMap((o) => [o.zdroj_url, o.web]),
      ]
        .filter(Boolean)
        .map(normalizujUrl),
    );
    const zkontrolujDatum = (cesta, datum) => {
      if (cisloDne(datum) > cisloDne(dnes)) chyby.push(`${cesta}: datum ${datum} je v budoucnosti`);
    };
    if (kontrola.zdrojeZkontrolovany) zkontrolujDatum('kontrola.zdrojeZkontrolovany', kontrola.zdrojeZkontrolovany);
    for (const [url, datum] of Object.entries(kontrola.url)) {
      zkontrolujDatum(`kontrola.url["${url}"]`, datum);
      if (!zdrojeAktivit.has(url)) varovani.push(`kontrola.url["${url}"]: URL není zdroj_url žádné aktivity ani organizace (zastaralý záznam?)`);
    }
  }

  return { chyby, varovani };
}

/** Spustí celou validaci nad soubory v repozitáři. */
export async function validuj({ dnes = dnesPraha() } = {}) {
  const validatory = await vytvorValidatory();
  const [organizace, aktivity, aktivityDospeli, meta, kontrola] = await Promise.all([
    nactiJson('site/data/organizace.json'),
    nactiJson('site/data/aktivity.json'),
    nactiJson('site/data/dospeli/aktivity.json'),
    nactiJson('site/data/meta.json'),
    // kontrola.json je nepovinný (vzniká až při běhu monitoringu)
    nactiJson('site/data/kontrola.json').catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e))),
  ]);

  const chyby = [];
  for (const [soubor, validator, data] of [
    ['organizace', validatory.organizace, organizace],
    ['aktivity', validatory.aktivity, aktivity],
    ['dospeli', validatory.aktivityDospeli, aktivityDospeli],
    ['meta', validatory.meta, meta],
    ...(kontrola ? [['kontrola', validatory.kontrola, kontrola]] : []),
  ]) {
    if (!validator(data)) chyby.push(...validator.errors.map((e) => popisChybyAjv(soubor, e)));
  }
  // Logické kontroly mají smysl jen nad daty se správnou strukturou.
  if (chyby.length) return { chyby, varovani: [] };

  const { KATEGORIE, SKUPINY_KATEGORII, KATEGORIE_DOSPELI, SKUPINY_KATEGORII_DOSPELI } = await import(
    pathToFileURL(path.join(KOREN, 'site/js/data.js')).href
  );
  return zkontrolujData({
    organizace,
    aktivity,
    kategorieSchema: validatory.schemaAktivity.$defs.kategorie.enum,
    kategorieUi: Object.keys(KATEGORIE),
    skupinyUi: SKUPINY_KATEGORII,
    aktivityDospeli,
    kategorieSchemaDospeli: validatory.schemaAktivityDospeli.$defs.kategorie.enum,
    kategorieUiDospeli: Object.keys(KATEGORIE_DOSPELI),
    skupinyUiDospeli: SKUPINY_KATEGORII_DOSPELI,
    kontrola,
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

// Logika filtrování, vyhledávání a řazení. Čisté funkce bez přístupu k DOM.

import { SKUPINY_KATEGORII, skupinaKategorie } from './data.js';
import { PORADI_STAVU, stavPrihlasky } from './registration.js';

/** Výchozí věkové hranice, pokud je aktivita nemá vyplněné. */
const VEK_MIN = 0;
const VEK_MAX = 99;

/** Hodnoty filtru „Stav přihlášek“ (prázdný řetězec = vše). */
export const STAVY_FILTRU = Object.freeze({
  probiha: 'Přihlášky probíhají',
  brzy: 'Brzy začnou (do 30 dní)',
  prubezne: 'Průběžný nábor',
  // Všechny stavy, které nemají vlastní položku (plánováno, neznámý, ukončeno).
  ostatni: 'Ostatní',
});

function odpovidaStavu(a, stav, dnes) {
  const stavAktivity = stavPrihlasky(a.prihlaska, dnes).stav;
  if (stav === 'ostatni') return !Object.hasOwn(STAVY_FILTRU, stavAktivity);
  return stavAktivity === stav;
}

/** Hodnoty filtru „Pohlaví dítěte“ (prázdný řetězec = nezáleží). */
export const POHLAVI_FILTRU = Object.freeze({
  divky: 'Dívka',
  chlapci: 'Chlapec',
});

/** Hodnoty filtru „Den v týdnu“ v pořadí po → ne. */
export const DNY_FILTRU = Object.freeze({
  po: 'Po',
  ut: 'Út',
  st: 'St',
  ct: 'Čt',
  pa: 'Pá',
  so: 'So',
  ne: 'Ne',
});

/** Prázdné filtry. */
export function prazdneFiltry() {
  return { q: '', vek: null, dny: [], skup: [], kat: [], org: '', stav: '', pohlavi: '' };
}

/** Malá písmena bez diakritiky, např. „Klavír“ → „klavir“. */
export function normalizuj(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function textProHledani(aktivita, kontext) {
  const kategorie = aktivita.kategorie ?? [];
  const popiskyKategorii = kategorie.map((k) => kontext.kategorie?.[k] ?? k);
  const popiskySkupin = kategorie.map((k) => SKUPINY_KATEGORII[skupinaKategorie(k)]?.popisek);
  return normalizuj(
    [aktivita.nazev, aktivita.popis, aktivita.organizace?.nazev, ...popiskyKategorii, ...popiskySkupin, ...(aktivita.klicova_slova ?? [])]
      .filter(Boolean)
      .join(' '),
  );
}

function odpovidaVeku(aktivita, vek) {
  const od = aktivita.vek_od ?? VEK_MIN;
  const doVeku = aktivita.vek_do ?? VEK_MAX;
  return od <= vek && vek <= doVeku;
}

/** Aktivity bez pevného dne (např. ZUŠ, kde se rozvrh domlouvá individuálně) patří ke každému dni. */
function odpovidaDnum(aktivita, dny) {
  const dnyAktivity = aktivita.terminy?.dny ?? [];
  return !dnyAktivity.length || dnyAktivity.some((d) => dny.includes(d));
}

/**
 * Kategorie, kterým musí aktivita odpovídat (alespoň jedné). Za každou vybranou skupinu se vezmou
 * její vybrané podkategorie, a pokud žádné nejsou, celá skupina; výsledky skupin se sečtou.
 * Bez vybrané skupiny platí přímo `kat`. Prázdná množina znamená bez omezení.
 */
function hledaneKategorie(filtry) {
  const kat = filtry.kat ?? [];
  const skup = filtry.skup ?? [];
  if (!skup.length) return new Set(kat);
  const vysledek = new Set();
  for (const klic of skup) {
    const vSkupine = SKUPINY_KATEGORII[klic]?.kategorie ?? [];
    const vybrane = vSkupine.filter((k) => kat.includes(k));
    for (const k of vybrane.length ? vybrane : vSkupine) vysledek.add(k);
  }
  return vysledek;
}

/**
 * Vrátí aktivity odpovídající filtrům. Mezi skupinami filtrů platí AND, ve dnech, skupinách zaměření a kategoriích OR.
 * @param {object[]} aktivity aktivity s vlastností `organizace` (viz `pripravData`)
 * @param {{ q?: string, vek?: number|null, dny?: string[], skup?: string[], kat?: string[], org?: string, stav?: string }} filtry
 * @param {{ dnes: string, kategorie?: Record<string, string> }} kontext
 */
export function filtruj(aktivity, filtry, kontext) {
  const slova = normalizuj(filtry.q ?? '').split(/\s+/).filter(Boolean);
  const vek = Number.isInteger(filtry.vek) ? filtry.vek : null;
  const kategorie = hledaneKategorie(filtry);

  return aktivity.filter((a) => {
    if (slova.length) {
      const text = textProHledani(a, kontext);
      if (!slova.every((s) => text.includes(s))) return false;
    }
    if (vek !== null && !odpovidaVeku(a, vek)) return false;
    if (filtry.dny?.length && !odpovidaDnum(a, filtry.dny)) return false;
    if (kategorie.size && !(a.kategorie ?? []).some((k) => kategorie.has(k))) return false;
    if (filtry.org && a.organizace_id !== filtry.org) return false;
    // Aktivity bez určení pohlaví jsou pro všechny.
    if (filtry.pohlavi && a.pohlavi && a.pohlavi !== filtry.pohlavi) return false;
    if (filtry.stav && !odpovidaStavu(a, filtry.stav, kontext.dnes)) return false;
    return true;
  });
}

/**
 * Seřadí aktivity podle stavu přihlášek (probíhá, brzy, průběžně, plánováno, neznámý, ukončeno)
 * a v rámci stavu abecedně podle názvu. Vrací nové pole.
 */
export function seradi(aktivity, dnes) {
  const porovnej = new Intl.Collator('cs').compare;
  return aktivity
    .map((a) => ({ a, poradi: PORADI_STAVU.indexOf(stavPrihlasky(a.prihlaska, dnes).stav) }))
    .sort((x, y) => x.poradi - y.poradi || porovnej(x.a.nazev, y.a.nazev))
    .map((x) => x.a);
}

/** Jsou všechny filtry prázdné? */
export function jsouPrazdne(filtry) {
  return !filtry.q && filtry.vek == null && !(filtry.dny?.length) && !(filtry.skup?.length) && !(filtry.kat?.length) && !filtry.org && !filtry.stav && !filtry.pohlavi;
}

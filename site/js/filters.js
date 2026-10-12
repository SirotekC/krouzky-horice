// Logika filtrování, vyhledávání a řazení. Čisté funkce bez přístupu k DOM.

import { PORADI_STAVU, stavPrihlasky } from './registration.js';

/** Výchozí věkové hranice, pokud je aktivita nemá vyplněné. */
const VEK_MIN = 0;
const VEK_MAX = 99;

/** Hodnoty filtru „Stav přihlášek“ (prázdný řetězec = vše). */
export const STAVY_FILTRU = Object.freeze({
  probiha: 'Přihlášky probíhají',
  brzy: 'Brzy začnou (do 30 dní)',
  prubezne: 'Průběžný nábor',
});

/** Prázdné filtry. */
export function prazdneFiltry() {
  return { q: '', vek: null, kat: [], org: '', stav: '' };
}

/** Malá písmena bez diakritiky, např. „Klavír“ → „klavir“. */
export function normalizuj(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function textProHledani(aktivita, kontext) {
  const popiskyKategorii = (aktivita.kategorie ?? []).map((k) => kontext.kategorie?.[k] ?? k);
  return normalizuj(
    [aktivita.nazev, aktivita.popis, aktivita.organizace?.nazev, ...popiskyKategorii].filter(Boolean).join(' '),
  );
}

function odpovidaVeku(aktivita, vek) {
  const od = aktivita.vek_od ?? VEK_MIN;
  const doVeku = aktivita.vek_do ?? VEK_MAX;
  return od <= vek && vek <= doVeku;
}

/**
 * Vrátí aktivity odpovídající filtrům. Mezi skupinami filtrů platí AND, v kategoriích OR.
 * @param {object[]} aktivity aktivity s vlastností `organizace` (viz `pripravData`)
 * @param {{ q?: string, vek?: number|null, kat?: string[], org?: string, stav?: string }} filtry
 * @param {{ dnes: string, kategorie?: Record<string, string> }} kontext
 */
export function filtruj(aktivity, filtry, kontext) {
  const slova = normalizuj(filtry.q ?? '').split(/\s+/).filter(Boolean);
  const vek = Number.isInteger(filtry.vek) ? filtry.vek : null;
  const kategorie = new Set(filtry.kat ?? []);

  return aktivity.filter((a) => {
    if (slova.length) {
      const text = textProHledani(a, kontext);
      if (!slova.every((s) => text.includes(s))) return false;
    }
    if (vek !== null && !odpovidaVeku(a, vek)) return false;
    if (kategorie.size && !(a.kategorie ?? []).some((k) => kategorie.has(k))) return false;
    if (filtry.org && a.organizace_id !== filtry.org) return false;
    if (filtry.stav && stavPrihlasky(a.prihlaska, kontext.dnes).stav !== filtry.stav) return false;
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
  return !filtry.q && filtry.vek == null && !(filtry.kat?.length) && !filtry.org && !filtry.stav;
}

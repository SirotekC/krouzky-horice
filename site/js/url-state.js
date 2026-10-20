// Synchronizace filtrů s query stringem URL. Čisté funkce bez přístupu k DOM.

import { SKUPINY_KATEGORII, skupinaKategorie } from './data.js';
import { DNY_FILTRU, POHLAVI_FILTRU, STAVY_FILTRU, prazdneFiltry } from './filters.js';

const VZOR_ID = /^[a-z0-9-]+$/;

/** Skupiny bez duplicit v pořadí podle `SKUPINY_KATEGORII`, aby URL byla stabilní. */
function poradiSkupin(skupiny) {
  return Object.keys(SKUPINY_KATEGORII).filter((k) => skupiny.includes(k));
}

/**
 * Načte filtry z query stringu (např. `?q=klavir&vek=8&dny=po,st&skup=umeni,sport&kat=hudba,tanec&org=zus&stav=probiha&pohlavi=divky`).
 * Neplatné hodnoty tiše ignoruje. Podkategorie (`kat`) musí patřit do některé z vybraných skupin (`skup`);
 * chybí-li skupiny, odvodí se z platných kategorií (kvůli starším odkazům).
 * @param {string} search obsah `location.search`
 * @param {string[] | null} platneOrganizace pokud je zadáno, `org` mimo seznam se ignoruje
 */
export function filtryZUrl(search, platneOrganizace = null) {
  const parametry = new URLSearchParams(search);
  const filtry = prazdneFiltry();

  const q = parametry.get('q');
  if (q) filtry.q = q.trim().slice(0, 100);

  const vek = parametry.get('vek');
  if (vek !== null && /^\d{1,2}$/.test(vek) && Number(vek) <= 26) filtry.vek = Number(vek);

  const dny = parametry.get('dny');
  if (dny) filtry.dny = Object.keys(DNY_FILTRU).filter((d) => dny.split(',').includes(d));

  const skup = parametry.get('skup');
  if (skup) filtry.skup = poradiSkupin(skup.split(',').filter((k) => Object.hasOwn(SKUPINY_KATEGORII, k)));

  const kat = parametry.get('kat');
  if (kat) {
    const platne = [...new Set(kat.split(','))].filter((k) => skupinaKategorie(k) !== null);
    if (!filtry.skup.length) filtry.skup = poradiSkupin(platne.map(skupinaKategorie));
    filtry.kat = platne.filter((k) => filtry.skup.includes(skupinaKategorie(k)));
  }

  const org = parametry.get('org');
  if (org && VZOR_ID.test(org) && (!platneOrganizace || platneOrganizace.includes(org))) filtry.org = org;

  const stav = parametry.get('stav');
  if (stav && Object.hasOwn(STAVY_FILTRU, stav)) filtry.stav = stav;

  const pohlavi = parametry.get('pohlavi');
  if (pohlavi && Object.hasOwn(POHLAVI_FILTRU, pohlavi)) filtry.pohlavi = pohlavi;

  return filtry;
}

/** Převede filtry na query string včetně `?`, nebo prázdný řetězec, pokud nejsou žádné. */
export function filtryDoUrl(filtry) {
  const casti = [];
  const q = filtry.q?.trim();
  if (q) casti.push(`q=${encodeURIComponent(q)}`);
  if (Number.isInteger(filtry.vek)) casti.push(`vek=${filtry.vek}`);
  if (filtry.dny?.length) casti.push(`dny=${filtry.dny.join(',')}`);
  if (filtry.skup?.length) casti.push(`skup=${filtry.skup.map(encodeURIComponent).join(',')}`);
  if (filtry.kat?.length) casti.push(`kat=${filtry.kat.map(encodeURIComponent).join(',')}`);
  if (filtry.org) casti.push(`org=${encodeURIComponent(filtry.org)}`);
  if (filtry.stav) casti.push(`stav=${encodeURIComponent(filtry.stav)}`);
  if (filtry.pohlavi) casti.push(`pohlavi=${encodeURIComponent(filtry.pohlavi)}`);
  return casti.length ? `?${casti.join('&')}` : '';
}

const PREFIX_AKTIVITY = '#/aktivita/';

/** Odkaz (hash) na detail jedné aktivity, např. `#/aktivita/zus-horice-klavir`. */
export function odkazNaAktivitu(id) {
  return `${PREFIX_AKTIVITY}${encodeURIComponent(id)}`;
}

/**
 * Přečte cestu z `location.hash`.
 * - `{ typ: 'seznam' }` pro prázdný hash,
 * - `{ typ: 'aktivita', id }` pro `#/aktivita/{id}` (id ve tvaru `a-z0-9-`, jinak `id: null` = nenalezeno),
 * - `null` pro ostatní kotvy (např. `#vysledky`), které zobrazení nemění.
 * @param {string} hash
 */
export function cestaZHashe(hash) {
  if (!hash || hash === '#' || hash === '#/') return { typ: 'seznam' };
  if (!hash.startsWith('#/')) return null;
  if (!hash.startsWith(PREFIX_AKTIVITY)) return { typ: 'aktivita', id: null };
  let id;
  try {
    id = decodeURIComponent(hash.slice(PREFIX_AKTIVITY.length)).replace(/\/$/, '');
  } catch {
    id = '';
  }
  return { typ: 'aktivita', id: VZOR_ID.test(id) ? id : null };
}

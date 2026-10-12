// Synchronizace filtrů s query stringem URL. Čisté funkce bez přístupu k DOM.

import { KATEGORIE } from './data.js';
import { STAVY_FILTRU, prazdneFiltry } from './filters.js';

const VZOR_ID = /^[a-z0-9-]+$/;

/**
 * Načte filtry z query stringu (např. `?q=klavir&vek=8&kat=hudba,tanec&org=zus&stav=probiha`).
 * Neplatné hodnoty tiše ignoruje.
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

  const kat = parametry.get('kat');
  if (kat) {
    filtry.kat = [...new Set(kat.split(','))].filter((k) => Object.hasOwn(KATEGORIE, k));
  }

  const org = parametry.get('org');
  if (org && VZOR_ID.test(org) && (!platneOrganizace || platneOrganizace.includes(org))) filtry.org = org;

  const stav = parametry.get('stav');
  if (stav && Object.hasOwn(STAVY_FILTRU, stav)) filtry.stav = stav;

  return filtry;
}

/** Převede filtry na query string včetně `?`, nebo prázdný řetězec, pokud nejsou žádné. */
export function filtryDoUrl(filtry) {
  const casti = [];
  const q = filtry.q?.trim();
  if (q) casti.push(`q=${encodeURIComponent(q)}`);
  if (Number.isInteger(filtry.vek)) casti.push(`vek=${filtry.vek}`);
  if (filtry.kat?.length) casti.push(`kat=${filtry.kat.map(encodeURIComponent).join(',')}`);
  if (filtry.org) casti.push(`org=${encodeURIComponent(filtry.org)}`);
  if (filtry.stav) casti.push(`stav=${encodeURIComponent(filtry.stav)}`);
  return casti.length ? `?${casti.join('&')}` : '';
}

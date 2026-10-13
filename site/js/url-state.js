// Synchronizace filtrů s query stringem URL. Čisté funkce bez přístupu k DOM.

import { SKUPINY_KATEGORII, skupinaKategorie } from './data.js';
import { POHLAVI_FILTRU, STAVY_FILTRU, prazdneFiltry } from './filters.js';

const VZOR_ID = /^[a-z0-9-]+$/;

/**
 * Načte filtry z query stringu (např. `?q=klavir&vek=8&skup=umeni&kat=hudba,tanec&org=zus&stav=probiha&pohlavi=divky`).
 * Neplatné hodnoty tiše ignoruje. Podkategorie (`kat`) musí patřit do vybrané skupiny (`skup`);
 * chybí-li skupina, odvodí se z první platné kategorie (kvůli starším odkazům).
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

  const skup = parametry.get('skup');
  if (skup && Object.hasOwn(SKUPINY_KATEGORII, skup)) filtry.skup = skup;

  const kat = parametry.get('kat');
  if (kat) {
    const platne = [...new Set(kat.split(','))].filter((k) => skupinaKategorie(k) !== null);
    if (!filtry.skup && platne.length) filtry.skup = skupinaKategorie(platne[0]);
    filtry.kat = platne.filter((k) => skupinaKategorie(k) === filtry.skup);
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
  if (filtry.skup) casti.push(`skup=${encodeURIComponent(filtry.skup)}`);
  if (filtry.kat?.length) casti.push(`kat=${filtry.kat.map(encodeURIComponent).join(',')}`);
  if (filtry.org) casti.push(`org=${encodeURIComponent(filtry.org)}`);
  if (filtry.stav) casti.push(`stav=${encodeURIComponent(filtry.stav)}`);
  if (filtry.pohlavi) casti.push(`pohlavi=${encodeURIComponent(filtry.pohlavi)}`);
  return casti.length ? `?${casti.join('&')}` : '';
}

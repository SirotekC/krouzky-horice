// Seznam sledovaných URL: sestaví se z dat (aktivity, organizace) a z data-src/monitor.json.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalizujUrl } from '../../site/js/data.js';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VYCHOZI_NASTAVENI = path.join(KOREN, 'data-src', 'monitor.json');

// Čím vyšší číslo, tím vyšší priorita druhu při slučování stejné URL.
const PRIORITA = { dostupnost: 0, obsah: 1, prehled: 2 };

// Jedna implementace sdílená s webem (prohlížeč ji potřebuje pro vyhledání dat v kontrola.json).
export { normalizujUrl };

/**
 * Načte nastavení monitoringu.
 * @param {string} [cesta] výchozí je data-src/monitor.json
 * @returns {Promise<object>}
 */
export async function nactiNastaveni(cesta = VYCHOZI_NASTAVENI) {
  const text = await readFile(cesta, 'utf8');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${cesta}: neplatný JSON – ${e.message}`);
  }
}

/**
 * Sestaví seznam sledovaných URL. Stejná URL (po normalizaci) je v seznamu jednou,
 * druh má nejvyšší prioritu (prehled > obsah > dostupnost), použití se sčítají.
 * @param {{ aktivity: object[], organizace: object[], nastaveni: object }} vstup
 * @returns {Map<string, { druh: 'obsah'|'dostupnost'|'prehled', pouziti: {id: string, pole: string}[], vzorOdkazu?: string }>}
 */
export function sestavSeznamUrl({ aktivity, organizace, nastaveni }) {
  const seznam = new Map();

  function pridej(url, druh, id, pole, vzorOdkazu) {
    if (!url) return;
    const klic = normalizujUrl(url);
    let zaznam = seznam.get(klic);
    if (!zaznam) {
      zaznam = { druh, pouziti: [] };
      seznam.set(klic, zaznam);
    } else if (PRIORITA[druh] > PRIORITA[zaznam.druh]) {
      zaznam.druh = druh;
    }
    if (vzorOdkazu) zaznam.vzorOdkazu = vzorOdkazu;
    zaznam.pouziti.push({ id, pole });
  }

  for (const a of aktivity ?? []) {
    pridej(a.zdroj_url, 'obsah', a.id, 'zdroj_url');
    pridej(a.prihlaska?.odkaz, 'dostupnost', a.id, 'prihlaska.odkaz');
  }
  for (const o of organizace ?? []) {
    pridej(o.zdroj_url, 'obsah', o.id, 'zdroj_url');
    pridej(o.web, 'dostupnost', o.id, 'web');
  }
  for (const p of nastaveni?.prehledy ?? []) {
    pridej(p.url, p.vzorOdkazu ? 'prehled' : 'obsah', p.organizace_id, 'monitor.json', p.vzorOdkazu);
  }
  for (const d of nastaveni?.doplnkoveUrl ?? []) {
    pridej(d.url, 'obsah', d.organizace_id, 'monitor.json');
  }

  return seznam;
}

// Obsazenost kroužku (volná místa) na stránce zdroje a její porovnání s `prihlaska.kapacita` v datech.
// Z textu stránky se bere jen hodnota z pevného číselníku (volno, poslední místa, náhradníci, obsazeno);
// neznámá hodnota se do issue zkrátí, aby tam nemohl skončit delší text stránky.

import { htmlNaText } from './cisteni.mjs';
import { textPoslednichMist } from '../../site/js/registration.js';

const MAX_DELKA_NEZNAME = 40;

/**
 * Převede hodnotu z webu (např. „Poslední 3 místa“, „Přijímáme náhradníky“) na tvar `prihlaska.kapacita`.
 * @param {string} text
 * @returns {{ stav: string, volna_mista?: number } | { stav: null, neznama: string }}
 */
export function parsujKapacitu(text) {
  const t = text.replace(/\s+/g, ' ').trim().replace(/[!.]+$/, '').toLowerCase();
  if (t === 'volno') return { stav: 'volno' };
  if (t === 'obsazeno') return { stav: 'obsazeno' };
  if (t.includes('náhradník')) return { stav: 'nahradnici' };
  if (t === 'poslední místo') return { stav: 'posledni', volna_mista: 1 };
  const pocet = /^posledn(?:í|ích) (\d+) míst/.exec(t);
  if (pocet) return { stav: 'posledni', volna_mista: Number(pocet[1]) };
  if (t.startsWith('poslední míst')) return { stav: 'posledni' };
  return { stav: null, neznama: text.trim().slice(0, MAX_DELKA_NEZNAME) };
}

/**
 * Najde na stránce řádek s obsazeností a vrátí jeho hodnotu: zbytek řádku za popiskem, nebo
 * (když je HTML buňky zalomené a popisek je na řádku sám) následující řádek.
 * @param {string} html
 * @param {{ obsah?: string, kapacita: { radek: string } }} pravidla pravidla domény z monitor.json
 * @returns {object|null} výstup `parsujKapacitu`, `null` = řádek na stránce není
 */
export function kapacitaZHtml(html, pravidla) {
  const re = new RegExp(pravidla.kapacita.radek, 'u');
  const radky = htmlNaText(html, { obsah: pravidla.obsah }).split('\n');
  for (let i = 0; i < radky.length; i++) {
    const m = re.exec(radky[i]);
    if (!m) continue;
    const hodnota = radky[i].slice(m.index + m[0].length).trim() || radky[i + 1];
    return hodnota ? parsujKapacitu(hodnota) : null;
  }
  return null;
}

/** Shodují se obsazenost z webu a z dat? Počet míst se porovnává jen u „posledni“. */
export function stejnaKapacita(web, data) {
  if ((web?.stav ?? null) !== (data?.stav ?? null)) return false;
  return web?.stav !== 'posledni' || (web.volna_mista ?? null) === (data.volna_mista ?? null);
}

/**
 * Čitelný popis obsazenosti pro issue.
 * @param {object|null|undefined} k
 * @returns {string}
 */
export function popisKapacity(k) {
  if (!k) return 'neuvedeno';
  if (k.stav === null) return `neznámá hodnota „${k.neznama}“`;
  if (k.stav === 'posledni') return textPoslednichMist(k.volna_mista ?? null).toLowerCase();
  return { volno: 'volno', nahradnici: 'berou náhradníky', obsazeno: 'obsazeno' }[k.stav] ?? k.stav;
}

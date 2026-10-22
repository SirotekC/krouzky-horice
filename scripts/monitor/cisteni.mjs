// Čištění obsahu stránek a otisky: z HTML se vyrobí stabilní text, z něj SHA-256 otisk.
// Text stránek se nikam neukládá, do stavu jde jen otisk.

import { createHash } from 'node:crypto';
import { parse } from 'node-html-parser';
import { normalizujUrl } from './seznam-url.mjs';

/** Zvýšit při jakékoli změně algoritmu čištění (zneplatní uložené otisky). */
export const VERZE_CISTENI = 1;

const ODSTRANIT = 'script, style, noscript, nav, header, footer, form';
const BLOKOVE = new Set([
  'p', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'table', 'section', 'article',
]);

/**
 * Najde název kódování: nejdřív z hlavičky Content-Type, pak z `<meta>` v prvních 2 kB.
 * @param {Buffer} telo
 * @param {string|null} contentType
 * @returns {string}
 */
function zjistiKodovani(telo, contentType) {
  const zHlavicky = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? '');
  if (zHlavicky) return zHlavicky[1];
  const uvod = telo.subarray(0, 2048).toString('latin1');
  const zMeta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(uvod);
  return zMeta ? zMeta[1] : 'utf-8';
}

/**
 * Dekóduje tělo odpovědi podle charsetu z hlavičky, jinak z `<meta>`, jinak jako UTF-8.
 * Neznámé kódování = UTF-8.
 * @param {Buffer} telo
 * @param {string|null} contentType
 * @returns {string}
 */
export function dekoduj(telo, contentType) {
  const kodovani = zjistiKodovani(telo, contentType);
  let dekoder;
  try {
    dekoder = new TextDecoder(kodovani);
  } catch {
    dekoder = new TextDecoder('utf-8');
  }
  return dekoder.decode(telo);
}

/**
 * Projde uzel a vrátí text; blokové prvky zakončí novým řádkem, buňky spojí mezerou.
 * @param {import('node-html-parser').Node} uzel
 * @returns {string}
 */
function textUzlu(uzel) {
  if (uzel.nodeType === 3) return uzel.rawText;
  if (uzel.nodeType !== 1) return '';
  const znacka = (uzel.tagName ?? '').toLowerCase();
  const vnitrek = uzel.childNodes.map(textUzlu).join('');
  const bunka = znacka === 'td' || znacka === 'th' ? ' ' : '';
  if (znacka === 'br') return '\n';
  return BLOKOVE.has(znacka) ? `\n${vnitrek}\n` : `${vnitrek}${bunka}`;
}

/**
 * Převede HTML na stabilní text pro otisk.
 * @param {string} html
 * @param {{ obsah?: string, odstranitRadky?: string[] }} [pravidla]
 * @returns {string}
 */
export function htmlNaText(html, pravidla = {}) {
  const koren = parse(html);
  for (const el of koren.querySelectorAll(ODSTRANIT)) el.remove();
  const zaklad = (pravidla.obsah && koren.querySelector(pravidla.obsah)) || koren.querySelector('body') || koren;

  const vyrazy = (pravidla.odstranitRadky ?? []).map((v) => new RegExp(v, 'u'));
  return textUzlu(zaklad)
    .split('\n')
    .map((r) => r.replace(/\s+/g, ' ').trim())
    .filter((r) => r && !vyrazy.some((v) => v.test(r)))
    .join('\n');
}

/**
 * Vrátí absolutní, normalizované, unikátní a seřazené odkazy z `a[href]`, které odpovídají vzoru.
 * @param {string} html
 * @param {string} zakladUrl
 * @param {string} vzor regulární výraz (řetězec)
 * @returns {string[]}
 */
export function odkazyPrehledu(html, zakladUrl, vzor) {
  const re = new RegExp(vzor, 'u');
  const nalezene = new Set();
  for (const a of parse(html).querySelectorAll('a[href]')) {
    let url;
    try {
      url = normalizujUrl(new URL(a.getAttribute('href'), zakladUrl).href);
    } catch {
      continue; // neplatný odkaz
    }
    if (re.test(url)) nalezene.add(url);
  }
  return [...nalezene].sort();
}

/**
 * SHA-256 otisk v hex zápisu.
 * @param {string|Buffer} data
 * @returns {string}
 */
export function otisk(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Otisk pravidel čištění domény + verze algoritmu; změna = nutnost znovu potvrdit základ.
 * @param {object|undefined} pravidlaDomeny
 * @returns {string}
 */
export function verzePravidel(pravidlaDomeny) {
  return otisk(`${VERZE_CISTENI}:${JSON.stringify(pravidlaDomeny ?? {})}`);
}

/**
 * Je odpověď HTML (podle Content-Type)?
 * @param {string|null} contentType
 * @returns {boolean}
 */
export function jeHtml(contentType) {
  return /^\s*(text\/html|application\/xhtml\+xml)\b/i.test(contentType ?? '');
}

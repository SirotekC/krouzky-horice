// Stahování zdrojů (ruční přesměrování, limity, klasifikace chyb) a plánovač po doménách.

import { normalizujUrl } from './seznam-url.mjs';

const MAX_PRESMEROVANI = 5;
const PRESMEROVANI_STATUSY = new Set([301, 302, 303, 307, 308]);
const TRVALE_STATUSY = new Set([301, 308]);

/** Chyba „tělo je příliš velké“ (vnitřní signál pro stahni). */
class PrilisVelke extends Error {}

/**
 * Určí druh chyby z výjimky `fetch` (undici nese kód v `cause.code`).
 * @param {any} e
 * @returns {string}
 */
function druhZVyjimky(e) {
  if (e instanceof PrilisVelke) return 'prilis-velke';
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return 'timeout';
  const kod = String(e?.cause?.code ?? e?.code ?? '');
  if (kod === 'ENOTFOUND' || kod === 'EAI_AGAIN') return 'dns';
  if (/^CERT_|_SELF_SIGNED_|^UNABLE_TO_VERIFY_/.test(kod)) return 'certifikat';
  return 'sit';
}

/**
 * Druh chyby podle HTTP stavu, nebo `null` pro úspěšnou odpověď.
 * @param {number} status
 * @returns {string|null}
 */
function druhZeStavu(status) {
  if (status === 403 || status === 429) return 'odmitnuto';
  if (status === 404) return '404';
  if (status === 410) return '410';
  if (status >= 500) return '5xx';
  if (status >= 400) return 'sit';
  return null;
}

/**
 * Přečte tělo jako proud a přeruší ho po překročení `maxBajtu`.
 * @param {Response} odpoved
 * @param {number} maxBajtu
 * @returns {Promise<Buffer>}
 */
async function precti(odpoved, maxBajtu) {
  const deklarovano = Number(odpoved.headers.get('content-length'));
  if (Number.isFinite(deklarovano) && deklarovano > maxBajtu) {
    await odpoved.body?.cancel().catch(() => {});
    throw new PrilisVelke();
  }
  if (!odpoved.body) return Buffer.alloc(0);
  const ctecka = odpoved.body.getReader();
  const kusy = [];
  let celkem = 0;
  for (;;) {
    const { done, value } = await ctecka.read();
    if (done) break;
    celkem += value.byteLength;
    if (celkem > maxBajtu) {
      await ctecka.cancel().catch(() => {});
      throw new PrilisVelke();
    }
    kusy.push(Buffer.from(value));
  }
  return Buffer.concat(kusy);
}

/**
 * Stáhne URL: ruční přesměrování (max. 5), podmíněné hlavičky, limit velikosti, klasifikace chyb.
 * `druh === 'dostupnost'` používá HEAD (při 405/501 GET bez čtení těla), jinak GET.
 * @param {string} url
 * @param {{ druh?: string, etag?: string|null, lastModified?: string|null }} [stav]
 * @param {{ fetchFn?: typeof fetch, ua?: string, timeoutMs?: number, maxBajtu?: number }} [moznosti]
 * @returns {Promise<{ status: number|null, beZmeny: boolean, telo: Buffer|null, contentType: string|null,
 *   etag: string|null, lastModified: string|null, konecnaUrl: string, trvalePresmerovano: boolean,
 *   chyba: null | { druh: string, status: number|null } }>}
 */
export async function stahni(url, stav = {}, moznosti = {}) {
  const { fetchFn = fetch, ua, timeoutMs = 20000, maxBajtu = 10 * 1024 * 1024 } = moznosti;
  const { druh, etag, lastModified } = stav;
  const jenDostupnost = druh === 'dostupnost';

  const vysledek = {
    status: null, beZmeny: false, telo: null, contentType: null, etag: null, lastModified: null,
    konecnaUrl: url, trvalePresmerovano: false, chyba: null,
  };

  const ridic = new AbortController();
  const casovac = setTimeout(() => ridic.abort(), timeoutMs);
  try {
    let aktualni = url;
    let metoda = jenDostupnost ? 'HEAD' : 'GET';
    let trvale = false;

    for (let skok = 0; ; skok++) {
      const hlavicky = {};
      if (ua) hlavicky['User-Agent'] = ua;
      if (!jenDostupnost) {
        if (etag) hlavicky['If-None-Match'] = etag;
        if (lastModified) hlavicky['If-Modified-Since'] = lastModified;
      }
      let odpoved = await fetchFn(aktualni, { method: metoda, headers: hlavicky, redirect: 'manual', signal: ridic.signal });

      if (metoda === 'HEAD' && (odpoved.status === 405 || odpoved.status === 501)) {
        await odpoved.body?.cancel().catch(() => {});
        metoda = 'GET';
        odpoved = await fetchFn(aktualni, { method: metoda, headers: hlavicky, redirect: 'manual', signal: ridic.signal });
      }

      if (PRESMEROVANI_STATUSY.has(odpoved.status)) {
        await odpoved.body?.cancel().catch(() => {});
        const cil = odpoved.headers.get('location');
        if (!cil) {
          vysledek.status = odpoved.status;
          vysledek.chyba = { druh: 'sit', status: odpoved.status };
          break;
        }
        if (skok >= MAX_PRESMEROVANI) {
          vysledek.status = odpoved.status;
          vysledek.chyba = { druh: 'sit', status: odpoved.status };
          break;
        }
        if (TRVALE_STATUSY.has(odpoved.status)) trvale = true;
        aktualni = new URL(cil, aktualni).href;
        continue;
      }

      vysledek.status = odpoved.status;
      vysledek.konecnaUrl = aktualni;
      vysledek.trvalePresmerovano = trvale && normalizujUrl(aktualni) !== normalizujUrl(url);
      vysledek.contentType = odpoved.headers.get('content-type');
      vysledek.etag = odpoved.headers.get('etag');
      vysledek.lastModified = odpoved.headers.get('last-modified');

      if (odpoved.status === 304) {
        vysledek.beZmeny = true;
        await odpoved.body?.cancel().catch(() => {});
        return vysledek;
      }
      const dr = druhZeStavu(odpoved.status);
      if (dr) {
        await odpoved.body?.cancel().catch(() => {});
        vysledek.chyba = { druh: dr, status: odpoved.status };
        return vysledek;
      }
      if (jenDostupnost) {
        await odpoved.body?.cancel().catch(() => {});
        return vysledek;
      }
      vysledek.telo = await precti(odpoved, maxBajtu);
      return vysledek;
    }

    // Vyčerpaný limit přesměrování nebo přesměrování bez `Location`.
    vysledek.konecnaUrl = aktualni;
    return vysledek;
  } catch (e) {
    vysledek.telo = null;
    vysledek.chyba = { druh: druhZVyjimky(e), status: vysledek.status };
    return vysledek;
  } finally {
    clearTimeout(casovac);
  }
}

/**
 * Zpracuje položky po doménách: v rámci domény sekvenčně s pauzou mezi požadavky,
 * domény souběžně. Pořadí výsledků odpovídá pořadí vstupu.
 * @template T
 * @param {{ url: string }[]} polozky
 * @param {(polozka: { url: string }) => Promise<T>} zpracuj
 * @param {{ pauzaProDomenu: (hostname: string) => number, cekej?: (ms: number) => Promise<void> }} moznosti
 * @returns {Promise<T[]>}
 */
export async function zpracujPoDomenach(polozky, zpracuj, { pauzaProDomenu, cekej = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const fronty = new Map();
  polozky.forEach((polozka, i) => {
    const host = new URL(polozka.url).hostname.toLowerCase();
    if (!fronty.has(host)) fronty.set(host, []);
    fronty.get(host).push({ polozka, i });
  });

  const vysledky = new Array(polozky.length);
  await Promise.all([...fronty].map(async ([host, fronta]) => {
    for (let k = 0; k < fronta.length; k++) {
      if (k > 0) await cekej(pauzaProDomenu(host));
      vysledky[fronta[k].i] = await zpracuj(fronta[k].polozka);
    }
  }));
  return vysledky;
}

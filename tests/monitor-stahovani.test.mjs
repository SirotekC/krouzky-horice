import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stahni, zpracujPoDomenach } from '../scripts/monitor/stahovani.mjs';

const UA = 'KrouzkyHorice-monitor/1.0 (+https://krouzky.cendas.cz/o-projektu.html)';

/** Falešný fetch: odpovědi bere postupně z pole, zaznamenává požadavky. */
function falesnyFetch(odpovedi) {
  const volani = [];
  const fn = async (url, opts) => {
    volani.push({ url: String(url), metoda: opts?.method, hlavicky: { ...(opts?.headers ?? {}) }, redirect: opts?.redirect });
    const o = odpovedi.shift();
    if (o instanceof Error) throw o;
    return o;
  };
  fn.volani = volani;
  return fn;
}

const U = 'https://a.cz/x';

test('304 → beZmeny, bez těla', async () => {
  const f = falesnyFetch([new Response(null, { status: 304 })]);
  const v = await stahni(U, { druh: 'obsah', etag: '"1"' }, { fetchFn: f, ua: UA });
  assert.equal(v.beZmeny, true);
  assert.equal(v.telo, null);
  assert.equal(v.status, 304);
  assert.equal(v.chyba, null);
});

test('200 vrátí tělo, content-type, etag a last-modified', async () => {
  const f = falesnyFetch([new Response('ahoj', { status: 200, headers: { 'content-type': 'text/html', etag: '"2"', 'last-modified': 'Mon, 01 Jan 2026 00:00:00 GMT' } })]);
  const v = await stahni(U, { druh: 'obsah' }, { fetchFn: f, ua: UA });
  assert.equal(v.telo.toString(), 'ahoj');
  assert.equal(v.contentType, 'text/html');
  assert.equal(v.etag, '"2"');
  assert.equal(v.lastModified, 'Mon, 01 Jan 2026 00:00:00 GMT');
  assert.equal(v.konecnaUrl, U);
  assert.equal(v.trvalePresmerovano, false);
  assert.equal(f.volani[0].redirect, 'manual');
  assert.equal(f.volani[0].hlavicky['User-Agent'], UA);
});

test('posílá If-None-Match a If-Modified-Since', async () => {
  const f = falesnyFetch([new Response(null, { status: 304 })]);
  await stahni(U, { druh: 'obsah', etag: '"abc"', lastModified: 'Mon, 01 Jan 2026 00:00:00 GMT' }, { fetchFn: f, ua: UA });
  assert.equal(f.volani[0].metoda, 'GET');
  assert.equal(f.volani[0].hlavicky['If-None-Match'], '"abc"');
  assert.equal(f.volani[0].hlavicky['If-Modified-Since'], 'Mon, 01 Jan 2026 00:00:00 GMT');
});

test('dostupnost: HEAD, při 405 GET', async () => {
  const f = falesnyFetch([new Response(null, { status: 405 }), new Response('telo', { status: 200 })]);
  const v = await stahni(U, { druh: 'dostupnost' }, { fetchFn: f, ua: UA });
  assert.deepEqual(f.volani.map((c) => c.metoda), ['HEAD', 'GET']);
  assert.equal(v.status, 200);
  assert.equal(v.telo, null);
  assert.equal(v.chyba, null);
});

test('301 na jinou URL → trvalePresmerovano a konecnaUrl', async () => {
  const f = falesnyFetch([
    new Response(null, { status: 301, headers: { location: '/krouzky' } }),
    new Response('prehled', { status: 200 }),
  ]);
  const v = await stahni('https://a.cz/krouzky/12-fit', { druh: 'obsah' }, { fetchFn: f, ua: UA });
  assert.equal(v.trvalePresmerovano, true);
  assert.equal(v.konecnaUrl, 'https://a.cz/krouzky');
  assert.equal(v.status, 200);
  assert.equal(f.volani[1].url, 'https://a.cz/krouzky');
});

test('301 jen na normalizovaně stejnou URL (kořen s lomítkem) → není trvalé', async () => {
  const f = falesnyFetch([
    new Response(null, { status: 301, headers: { location: 'https://a.cz/' } }),
    new Response('x', { status: 200 }),
  ]);
  const v = await stahni('https://a.cz', { druh: 'obsah' }, { fetchFn: f, ua: UA });
  assert.equal(v.trvalePresmerovano, false);
});

test('302 → není trvalé, ale konecnaUrl se sleduje', async () => {
  const f = falesnyFetch([
    new Response(null, { status: 302, headers: { location: 'https://a.cz/jine' } }),
    new Response('x', { status: 200 }),
  ]);
  const v = await stahni(U, { druh: 'obsah' }, { fetchFn: f, ua: UA });
  assert.equal(v.trvalePresmerovano, false);
  assert.equal(v.konecnaUrl, 'https://a.cz/jine');
});

test('301 následované 302 na jinou URL → trvalé (cokoli v řetězu)', async () => {
  const f = falesnyFetch([
    new Response(null, { status: 301, headers: { location: '/b' } }),
    new Response(null, { status: 302, headers: { location: '/c' } }),
    new Response('x', { status: 200 }),
  ]);
  const v = await stahni(U, { druh: 'obsah' }, { fetchFn: f, ua: UA });
  assert.equal(v.trvalePresmerovano, true);
  assert.equal(v.konecnaUrl, 'https://a.cz/c');
});

test('více než 5 přesměrování → chyba sit', async () => {
  const odp = Array.from({ length: 7 }, (_, i) => new Response(null, { status: 302, headers: { location: `/r${i}` } }));
  const f = falesnyFetch(odp);
  const v = await stahni(U, { druh: 'obsah' }, { fetchFn: f, ua: UA });
  assert.equal(v.chyba.druh, 'sit');
  assert.equal(f.volani.length, 6);
});

test('403 a 429 → odmitnuto, 404 → 404, 410 → 410, 503 → 5xx', async () => {
  const cti = (status) => stahni(U, { druh: 'obsah' }, { fetchFn: falesnyFetch([new Response('x', { status })]), ua: UA });
  assert.deepEqual((await cti(403)).chyba, { druh: 'odmitnuto', status: 403 });
  assert.deepEqual((await cti(429)).chyba, { druh: 'odmitnuto', status: 429 });
  assert.deepEqual((await cti(404)).chyba, { druh: '404', status: 404 });
  assert.deepEqual((await cti(410)).chyba, { druh: '410', status: 410 });
  const v = await cti(503);
  assert.deepEqual(v.chyba, { druh: '5xx', status: 503 });
  assert.equal(v.telo, null);
});

test('tělo nad limit → prilis-velke (stream i content-length)', async () => {
  const v1 = await stahni(U, { druh: 'obsah' }, { fetchFn: falesnyFetch([new Response('x'.repeat(100), { status: 200 })]), ua: UA, maxBajtu: 10 });
  assert.equal(v1.chyba.druh, 'prilis-velke');
  assert.equal(v1.telo, null);
  const v2 = await stahni(U, { druh: 'obsah' }, { fetchFn: falesnyFetch([new Response('x', { status: 200, headers: { 'content-length': '999' } })]), ua: UA, maxBajtu: 10 });
  assert.equal(v2.chyba.druh, 'prilis-velke');
});

test('síťové chyby: dns, certifikat, timeout, sit', async () => {
  const sPriciny = (code) => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('x'), { code }) });
  const chyba = async (e) => (await stahni(U, { druh: 'obsah' }, { fetchFn: falesnyFetch([e]), ua: UA })).chyba;
  assert.equal((await chyba(sPriciny('ENOTFOUND'))).druh, 'dns');
  assert.equal((await chyba(sPriciny('EAI_AGAIN'))).druh, 'dns');
  assert.equal((await chyba(sPriciny('CERT_HAS_EXPIRED'))).druh, 'certifikat');
  assert.equal((await chyba(sPriciny('DEPTH_ZERO_SELF_SIGNED_CERT'))).druh, 'certifikat');
  assert.equal((await chyba(sPriciny('UNABLE_TO_VERIFY_LEAF_SIGNATURE'))).druh, 'certifikat');
  assert.equal((await chyba(Object.assign(new Error('a'), { name: 'AbortError' }))).druh, 'timeout');
  assert.equal((await chyba(Object.assign(new Error('a'), { name: 'TimeoutError' }))).druh, 'timeout');
  const s = await chyba(sPriciny('ECONNRESET'));
  assert.equal(s.druh, 'sit');
  assert.equal(s.status, null);
});

test('skutečný timeout přeruší visící požadavek', async () => {
  const fetchFn = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })));
  });
  const v = await stahni(U, { druh: 'obsah' }, { fetchFn, ua: UA, timeoutMs: 20 });
  assert.equal(v.chyba.druh, 'timeout');
});

test('plánovač: stejná doména sekvenčně s pauzou, různé souběžně', async () => {
  const pauzy = [];
  const cekej = async (ms) => { pauzy.push(ms); };
  const polozky = ['https://a.cz/1', 'https://a.cz/2', 'https://b.cz/1', 'https://a.cz/3'].map((url) => ({ url }));
  let bezi = 0;
  let maxA = 0;
  const vysl = await zpracujPoDomenach(polozky, async (p) => {
    const jeA = p.url.includes('a.cz');
    if (jeA) { bezi++; maxA = Math.max(maxA, bezi); }
    await new Promise((r) => setImmediate(r));
    if (jeA) bezi--;
    return p.url;
  }, { pauzaProDomenu: () => 5000, cekej });
  assert.deepEqual(vysl, polozky.map((p) => p.url));
  assert.deepEqual(pauzy, [5000, 5000]);
  assert.equal(maxA, 1);
});

test('plánovač: pauza podle domény a prázdný vstup', async () => {
  const pauzy = [];
  const cekej = async (ms) => { pauzy.push(ms); };
  assert.deepEqual(await zpracujPoDomenach([], async () => 1, { pauzaProDomenu: () => 1, cekej }), []);
  await zpracujPoDomenach([{ url: 'https://a.cz/1' }, { url: 'https://a.cz/2' }], async () => 0, { pauzaProDomenu: (h) => (h === 'a.cz' ? 7000 : 1), cekej });
  assert.deepEqual(pauzy, [7000]);
});

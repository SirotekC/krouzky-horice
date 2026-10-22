import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datumNacteni, datumNacteniWebu, normalizujUrl, nactiData } from '../site/js/data.js';

const aktivita = { overeno: '2026-10-19', zdroj_url: 'https://Www.Klub.cz/krouzky/#top' };

test('datumNacteni bere pozdější z overeno a kontroly', () => {
  const kontrola = { zdrojeZkontrolovany: '2026-10-25', url: { 'https://www.klub.cz/krouzky/': '2026-10-25' } };
  assert.equal(datumNacteni(aktivita, kontrola), '2026-10-25');
  assert.equal(datumNacteni(aktivita, null), '2026-10-19');
  assert.equal(datumNacteni(aktivita, { url: {} }), '2026-10-19');
  assert.equal(datumNacteni(aktivita, { url: { 'https://www.klub.cz/krouzky/': '2026-10-01' } }), '2026-10-19');
});

test('datumNacteni hledá podle normalizované URL (kořen bez lomítka)', () => {
  const a = { overeno: '2026-10-01', zdroj_url: 'https://Klub.cz/' };
  assert.equal(datumNacteni(a, { url: { 'https://klub.cz': '2026-10-20' } }), '2026-10-20');
});

test('datumNacteniWebu', () => {
  const meta = { aktualizovano: '2026-10-19' };
  assert.equal(datumNacteniWebu(meta, { zdrojeZkontrolovany: '2026-10-25', url: {} }), '2026-10-25');
  assert.equal(datumNacteniWebu(meta, { zdrojeZkontrolovany: null, url: {} }), '2026-10-19');
  assert.equal(datumNacteniWebu(meta, null), '2026-10-19');
  assert.equal(datumNacteniWebu(meta, { zdrojeZkontrolovany: '2026-10-01', url: {} }), '2026-10-19');
});

test('normalizujUrl je exportovaný z data.js', () => {
  assert.equal(normalizujUrl('https://X.cz/#a'), 'https://x.cz');
});

test('nactiData: chybějící kontrola.json → kontrola je null', async () => {
  const data = { 'organizace.json': [], 'aktivity.json': [], 'meta.json': { aktualizovano: '2026-10-19' } };
  const puvodni = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const soubor = String(url).split('/').pop();
    return soubor in data ? { ok: true, json: async () => data[soubor] } : { ok: false, status: 404 };
  };
  try {
    const vysledek = await nactiData('data/');
    assert.equal(vysledek.kontrola, null);
    assert.equal(vysledek.meta.aktualizovano, '2026-10-19');
  } finally {
    globalThis.fetch = puvodni;
  }
});

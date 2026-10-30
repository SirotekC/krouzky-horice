import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nactiData } from '../site/js/data.js';
import { SEKCE, aktualniSekce } from '../site/js/sekce.js';

test('aktualniSekce podle data-sekce, výchozí jsou děti', () => {
  assert.equal(aktualniSekce({ sekce: 'dospeli' }), SEKCE.dospeli);
  assert.equal(aktualniSekce({ sekce: 'deti' }), SEKCE.deti);
  assert.equal(aktualniSekce({}), SEKCE.deti);
  assert.equal(aktualniSekce({ sekce: 'x' }), SEKCE.deti);
  assert.equal(aktualniSekce(undefined), SEKCE.deti);
});

test('sekce na sebe navzájem odkazují', () => {
  assert.equal(SEKCE[SEKCE.deti.druhaSekce], SEKCE.dospeli);
  assert.equal(SEKCE[SEKCE.dospeli.druhaSekce], SEKCE.deti);
});

/** Mock `fetch` podle celé cesty (`data/aktivity.json` × `data/dospeli/aktivity.json`). */
async function sMockem(soubory, fn) {
  const puvodni = globalThis.fetch;
  globalThis.fetch = async (url) => (String(url) in soubory ? { ok: true, json: async () => soubory[String(url)] } : { ok: false, status: 404 });
  try {
    return await fn();
  } finally {
    globalThis.fetch = puvodni;
  }
}

const zakladni = {
  'data/organizace.json': [{ id: 'o', nazev: 'O' }],
  'data/meta.json': { aktualizovano: '2026-10-30' },
  'data/aktivity.json': [
    { id: 'krouzek', organizace_id: 'o', kategorie: ['hudba'] },
    { id: 'keramika', organizace_id: 'o', kategorie: ['vytvarne'], i_pro_dospele: true },
  ],
  'data/dospeli/aktivity.json': [
    { id: 'joga', organizace_id: 'o', kategorie: ['joga'] },
    { id: 'plavani-rodice', organizace_id: 'o', kategorie: ['sport-ostatni'], i_pro_deti: true },
  ],
};

test('nactiData dětí přidá dospělé aktivity s i_pro_deti', async () => {
  const data = await sMockem(zakladni, () => nactiData('data/', SEKCE.deti, SEKCE.dospeli));
  assert.deepEqual(data.aktivity.map((a) => [a.id, a.sekce]), [['krouzek', 'deti'], ['keramika', 'deti'], ['plavani-rodice', 'dospeli']]);
  assert.equal(data.aktivity[0].organizace.nazev, 'O');
});

test('nactiData dospělých přidá dětské aktivity s i_pro_dospele', async () => {
  const data = await sMockem(zakladni, () => nactiData('data/', SEKCE.dospeli, SEKCE.deti));
  assert.deepEqual(data.aktivity.map((a) => [a.id, a.sekce]), [['joga', 'dospeli'], ['plavani-rodice', 'dospeli'], ['keramika', 'deti']]);
});

test('chybějící dospeli/aktivity.json: dětská data se načtou', async () => {
  const { 'data/dospeli/aktivity.json': _, ...bezDospelych } = zakladni;
  const data = await sMockem(bezDospelych, () => nactiData('data/', SEKCE.deti, SEKCE.dospeli));
  assert.deepEqual(data.aktivity.map((a) => a.id), ['krouzek', 'keramika']);
});

test('chybějící vlastní soubor sekce je chyba', async () => {
  const { 'data/dospeli/aktivity.json': _, ...bezDospelych } = zakladni;
  await assert.rejects(sMockem(bezDospelych, () => nactiData('data/', SEKCE.dospeli, SEKCE.deti)), /dospeli\/aktivity\.json/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sestavKontrolu } from '../scripts/monitor/kontrola-webu.mjs';

function zaznam(posledniOk) {
  return { druh: 'obsah', posledniOk };
}

test('jen zdroj_url s posledniOk, seřazené klíče, zdrojeZkontrolovany = zapatiDatum', () => {
  const seznam = new Map([
    ['https://z.cz/k', { druh: 'obsah', pouziti: [{ id: 'z', pole: 'zdroj_url' }] }],
    ['https://a.cz/k', { druh: 'obsah', pouziti: [{ id: 'x', pole: 'monitor.json' }, { id: 'a', pole: 'zdroj_url' }] }],
    ['https://b.cz/bez-ok', { druh: 'obsah', pouziti: [{ id: 'b', pole: 'zdroj_url' }] }],
    ['https://c.cz/prihlaska', { druh: 'dostupnost', pouziti: [{ id: 'c', pole: 'prihlaska.odkaz' }] }],
    ['https://d.cz/prehled', { druh: 'prehled', pouziti: [{ id: 'd', pole: 'monitor.json' }] }],
    ['https://e.cz/neni-ve-stavu', { druh: 'obsah', pouziti: [{ id: 'e', pole: 'zdroj_url' }] }],
  ]);
  const stav = {
    verze: 1,
    posledniBeh: '2026-10-25',
    zapatiDatum: '2026-10-22',
    url: {
      'https://z.cz/k': zaznam('2026-10-25'),
      'https://a.cz/k': zaznam('2026-10-19'),
      'https://b.cz/bez-ok': zaznam(null),
      'https://c.cz/prihlaska': zaznam('2026-10-25'),
      'https://d.cz/prehled': zaznam('2026-10-25'),
      'https://f.cz/mimo-seznam': zaznam('2026-10-25'),
    },
  };
  const kontrola = sestavKontrolu(stav, seznam);
  assert.deepEqual(kontrola, {
    zdrojeZkontrolovany: '2026-10-22',
    url: { 'https://a.cz/k': '2026-10-19', 'https://z.cz/k': '2026-10-25' },
  });
  assert.deepEqual(Object.keys(kontrola.url), ['https://a.cz/k', 'https://z.cz/k']);
});

test('prázdný stav: zdrojeZkontrolovany null, žádné URL', () => {
  const seznam = new Map([['https://a.cz/k', { druh: 'obsah', pouziti: [{ id: 'a', pole: 'zdroj_url' }] }]]);
  assert.deepEqual(sestavKontrolu({ verze: 1, posledniBeh: null, zapatiDatum: null, url: {} }, seznam), {
    zdrojeZkontrolovany: null,
    url: {},
  });
});

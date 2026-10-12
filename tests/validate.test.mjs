import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citelnaCesta, zkontrolujData } from '../scripts/validate.mjs';

const DNES = '2026-10-12';
const org = (id, overeno = DNES) => ({ id, overeno });
const akt = (id, organizace_id, zmeny = {}) => ({
  id,
  organizace_id,
  overeno: DNES,
  prihlaska: { od: null, do: null },
  ...zmeny,
});

const zaklad = (organizace, aktivity, zmeny = {}) =>
  zkontrolujData({ organizace, aktivity, kategorieSchema: ['a', 'b'], kategorieUi: ['a', 'b'], dnes: DNES, ...zmeny });

test('citelnaCesta', () => {
  assert.equal(citelnaCesta('aktivity', '/3/prihlaska/do'), 'aktivity[3].prihlaska.do');
  assert.equal(citelnaCesta('meta', ''), 'meta');
});

test('platná data nemají chyby', () => {
  assert.deepEqual(zaklad([org('o')], [akt('a', 'o')]), { chyby: [], varovani: [] });
});

test('neexistující organizace_id je chyba s jasnou hláškou', () => {
  const { chyby } = zaklad([org('o')], [akt('a', 'o'), akt('b', 'neni')]);
  assert.equal(chyby.length, 1);
  assert.match(chyby[0], /^aktivity\[1\]\.organizace_id: organizace „neni“ neexistuje/);
});

test('duplicitní id', () => {
  const { chyby } = zaklad([org('o'), org('o')], [akt('a', 'o'), akt('a', 'o')]);
  assert.equal(chyby.length, 2);
  assert.match(chyby[0], /^organizace\[1\]\.id: duplicitní id/);
  assert.match(chyby[1], /^aktivity\[1\]\.id: duplicitní id/);
});

test('vek_od > vek_do a od > do', () => {
  const { chyby } = zaklad([org('o')], [
    akt('a', 'o', { vek_od: 10, vek_do: 5 }),
    akt('b', 'o', { prihlaska: { od: '2027-06-01', do: '2027-05-01' } }),
  ]);
  assert.equal(chyby.length, 2);
  assert.match(chyby[0], /^aktivity\[0\]\.vek_do/);
  assert.match(chyby[1], /^aktivity\[1\]\.prihlaska\.do/);
});

test('overeno v budoucnosti je chyba, starší než 90 dní je varování', () => {
  const { chyby, varovani } = zaklad(
    [org('o', '2026-10-13')],
    [akt('a', 'o', { overeno: '2026-07-14' }), akt('b', 'o', { overeno: '2026-07-13' })],
  );
  assert.equal(chyby.length, 1);
  assert.match(chyby[0], /^organizace\[0\]\.overeno: .* v budoucnosti/);
  assert.equal(varovani.length, 1);
  assert.match(varovani[0], /^aktivity\[1\]\.overeno: údaje jsou 91 dní staré/);
});

test('nesoulad číselníku kategorií', () => {
  const { chyby } = zaklad([org('o')], [akt('a', 'o')], { kategorieSchema: ['a', 'b'], kategorieUi: ['a', 'c'] });
  assert.equal(chyby.length, 2);
  assert.match(chyby[0], /„b“ je ve schématu/);
  assert.match(chyby[1], /„c“ je v site\/js\/data\.js/);
});

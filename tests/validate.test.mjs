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

test('volna_mista jen u kapacity „posledni“', () => {
  const { chyby } = zaklad([org('o')], [
    akt('a', 'o', { prihlaska: { od: null, do: null, kapacita: { stav: 'posledni', volna_mista: 2 } } }),
    akt('b', 'o', { prihlaska: { od: null, do: null, kapacita: { stav: 'obsazeno', volna_mista: 2 } } }),
  ]);
  assert.equal(chyby.length, 1);
  assert.match(chyby[0], /^aktivity\[1\]\.prihlaska\.kapacita\.volna_mista/);
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

test('skupiny kategorií: každá kategorie právě v jedné skupině', () => {
  const skupinyUi = { x: { kategorie: ['a', 'b'] }, y: { kategorie: ['b', 'z'] } };
  const { chyby } = zaklad([org('o')], [akt('a', 'o')], { kategorieUi: ['a', 'b', 'c'], kategorieSchema: ['a', 'b', 'c'], skupinyUi });
  assert.equal(chyby.length, 3);
  assert.match(chyby[0], /„b“ je ve skupině „x“ i „y“/);
  assert.match(chyby[1], /„z“ ve skupině „y“ není v číselníku/);
  assert.match(chyby[2], /„c“ nepatří do žádné skupiny/);
});

test('dny termínů musí odpovídat rozvrhu', () => {
  const terminy = (dny) => ({ terminy: { rozvrh: [{ den: 'po' }, { den: 'st' }], dny } });
  const { chyby } = zaklad([org('o')], [akt('a', 'o', terminy(['po', 'st'])), akt('b', 'o', terminy(['po']))]);
  assert.equal(chyby.length, 1);
  assert.match(chyby[0], /^aktivity\[1\]\.terminy\.dny: dny \[po\] neodpovídají rozvrhu \[po,st\]/);
});

test('kontrola.json: datum v budoucnosti je chyba, neznámá URL varování', () => {
  const kontrola = {
    zdrojeZkontrolovany: '2026-10-20',
    url: { 'https://a.cz/x': '2026-10-12', 'https://a.cz/budoucnost': '2026-10-13', 'https://nezname.cz': '2026-10-12' },
  };
  const aktivity = [
    akt('a', 'o', { zdroj_url: 'https://A.cz/x#cast' }),
    akt('b', 'o', { zdroj_url: 'https://a.cz/budoucnost' }),
  ];
  const { chyby, varovani } = zaklad([org('o')], aktivity, { kontrola });
  assert.equal(chyby.length, 2);
  assert.match(chyby[0], /^kontrola\.zdrojeZkontrolovany: datum 2026-10-20 je v budoucnosti/);
  assert.match(chyby[1], /^kontrola\.url\["https:\/\/a\.cz\/budoucnost"\]: datum 2026-10-13 je v budoucnosti/);
  assert.equal(varovani.length, 1);
  assert.match(varovani[0], /nezname\.cz.*není zdroj_url žádné aktivity/);
});

test('kontrola.json: platná data a null zdrojeZkontrolovany bez chyb', () => {
  const aktivity = [akt('a', 'o', { zdroj_url: 'https://a.cz/x' })];
  assert.deepEqual(zaklad([org('o')], aktivity, { kontrola: { zdrojeZkontrolovany: null, url: { 'https://a.cz/x': DNES } } }), { chyby: [], varovani: [] });
  assert.deepEqual(zaklad([org('o')], aktivity, { kontrola: null }), { chyby: [], varovani: [] });
});
const dospeli = (organizace, aktivity, aktivityDospeli, zmeny = {}) =>
  zaklad(organizace, aktivity, {
    aktivityDospeli,
    kategorieSchemaDospeli: ['a', 'joga'],
    kategorieUiDospeli: ['a', 'joga'],
    ...zmeny,
  });

test('dospělí: platná data nemají chyby', () => {
  assert.deepEqual(dospeli([org('o')], [akt('a', 'o')], [akt('d', 'o', { kategorie: ['joga'] })]), { chyby: [], varovani: [] });
});

test('duplicitní id napříč sekcemi', () => {
  const { chyby } = dospeli([org('o')], [akt('x', 'o')], [akt('x', 'o')]);
  assert.equal(chyby.length, 1);
  assert.match(chyby[0], /^dospeli\[0\]\.id: duplicitní id „x“/);
});

test('organizace_id dospělé aktivity musí existovat', () => {
  const { chyby } = dospeli([org('o')], [], [akt('d', 'neni')]);
  assert.equal(chyby.length, 1);
  assert.match(chyby[0], /^dospeli\[0\]\.organizace_id: organizace „neni“ neexistuje/);
});

test('i_pro_dospele s kategorií, kterou dospělí nemají', () => {
  const { chyby } = dospeli([org('o')], [akt('a', 'o', { kategorie: ['b'], i_pro_dospele: true, prihlaska: { od: null, do: null, typ: 'prihlaska' } }), akt('c', 'o', { kategorie: ['b'] })], []);
  assert.equal(chyby.length, 1);
  assert.match(chyby[0], /^aktivity\[0\]\.kategorie: „b“ není v číselníku dospělých \(i_pro_dospele\)/);
});

test('i_pro_deti s kategorií joga', () => {
  const { chyby } = dospeli([org('o')], [], [akt('d', 'o', { kategorie: ['joga'], i_pro_deti: true })]);
  assert.equal(chyby.length, 1);
  assert.match(chyby[0], /^dospeli\[0\]\.kategorie: „joga“ není v číselníku dětí \(i_pro_deti\)/);
});

test('kategorie dospělých: schéma vs. UI', () => {
  const { chyby } = dospeli([org('o')], [], [], { kategorieSchemaDospeli: ['a', 'joga'], kategorieUiDospeli: ['a', 'tanec'] });
  assert.equal(chyby.length, 2);
  assert.match(chyby[0], /^kategorie dospělých: „joga“ je ve schématu/);
  assert.match(chyby[1], /^kategorie dospělých: „tanec“ je v site\/js\/data\.js/);
});

test('dospělí: overeno v budoucnosti a kontroly přihlášky', () => {
  const { chyby } = dospeli([org('o')], [], [akt('d', 'o', { overeno: '2026-12-01', prihlaska: { od: '2027-06-01', do: '2027-05-01' } })]);
  assert.equal(chyby.length, 2);
  assert.match(chyby[0], /^dospeli\[0\]\.overeno/);
  assert.match(chyby[1], /^dospeli\[0\]\.prihlaska\.do/);
});

test('kontrola: URL zdroje dospělé aktivity není zastaralý záznam', () => {
  const kontrola = { zdrojeZkontrolovany: null, url: { 'https://d.cz/x': DNES } };
  const { varovani } = dospeli([org('o')], [], [akt('d', 'o', { zdroj_url: 'https://d.cz/x' })], { kontrola });
  assert.deepEqual(varovani, []);
});

test('i_pro_dospele vyžaduje prihlaska.typ (filtr a karta „Vstup“ u dospělých)', () => {
  const { chyby } = dospeli([org('o')], [
    akt('a', 'o', { kategorie: ['a'], i_pro_dospele: true }),
    akt('b', 'o', { kategorie: ['a'], i_pro_dospele: true, prihlaska: { od: null, do: null, typ: 'prihlaska' } }),
  ], []);
  assert.equal(chyby.length, 1);
  assert.match(chyby[0], /^aktivity\[0\]\.prihlaska\.typ: u aktivity s i_pro_dospele je povinný/);
});

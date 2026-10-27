import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dnesPraha,
  formatDatum,
  formatObdobi,
  parseDatum,
  posunDatum,
  stavPrihlasky,
} from '../site/js/registration.js';

const p = (od, doData, prubezne = false) => ({ od, do: doData, prubezne });

test('parseDatum: platná a neplatná data', () => {
  assert.deepEqual(parseDatum('2027-05-01'), { rok: 2027, mesic: 5, den: 1 });
  assert.equal(parseDatum('2027-02-30'), null);
  assert.equal(parseDatum('1. 5. 2027'), null);
  assert.equal(parseDatum(null), null);
});

test('formatDatum a formatObdobi', () => {
  assert.equal(formatDatum('2027-05-01'), '1. 5. 2027');
  assert.equal(formatDatum('2027-05-01', { rok: false }), '1. 5.');
  assert.equal(formatDatum(null), '');
  assert.equal(formatObdobi('2027-05-01', '2027-06-15'), '1. 5. – 15. 6. 2027');
  assert.equal(formatObdobi('2026-12-01', '2027-01-15'), '1. 12. 2026 – 15. 1. 2027');
  assert.equal(formatObdobi('2027-05-01', null), 'od 1. 5. 2027');
  assert.equal(formatObdobi(null, '2027-06-15'), 'do 15. 6. 2027');
  assert.equal(formatObdobi(null, null), '');
});

test('posunDatum přes konec měsíce a roku', () => {
  assert.equal(posunDatum('2026-12-31', 1), '2027-01-01');
  assert.equal(posunDatum('2027-03-01', -1), '2027-02-28');
});

test('dnesPraha počítá v pásmu Europe/Prague', () => {
  // 23:30 UTC 31. 12. je v Praze už 1. 1. (zimní čas, UTC+1).
  assert.equal(dnesPraha(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  // 22:30 UTC 30. 6. je v Praze 00:30 1. 7. (letní čas, UTC+2).
  assert.equal(dnesPraha(new Date('2027-06-30T22:30:00Z')), '2027-07-01');
});

// Řádek 1: od a do vyplněné, od ≤ dnes ≤ do → probiha
test('probiha: uprostřed období', () => {
  assert.deepEqual(stavPrihlasky(p('2027-05-01', '2027-06-15'), '2027-05-20'), {
    stav: 'probiha',
    text: 'Přihlášky do 15. 6.',
  });
});

test('probiha: hraniční den dnes === od', () => {
  assert.equal(stavPrihlasky(p('2027-05-01', '2027-06-15'), '2027-05-01').stav, 'probiha');
});

test('probiha: hraniční den dnes === do', () => {
  assert.deepEqual(stavPrihlasky(p('2027-05-01', '2027-06-15'), '2027-06-15'), {
    stav: 'probiha',
    text: 'Končí dnes',
  });
});

test('probiha: zbývá ≤ 7 dní → „Končí za X dní“', () => {
  const pr = p('2027-05-01', '2027-06-15');
  assert.equal(stavPrihlasky(pr, '2027-06-08').text, 'Končí za 7 dní');
  assert.equal(stavPrihlasky(pr, '2027-06-12').text, 'Končí za 3 dny');
  assert.equal(stavPrihlasky(pr, '2027-06-14').text, 'Končí za 1 den');
  assert.equal(stavPrihlasky(pr, '2027-06-07').text, 'Přihlášky do 15. 6.');
});

// Řádek 2: od vyplněné, dnes < od, rozdíl ≤ 30 dní → brzy
test('brzy: začátek do 30 dní (hranice 30 dní)', () => {
  assert.deepEqual(stavPrihlasky(p('2027-05-01', '2027-06-15'), '2027-04-01'), {
    stav: 'brzy',
    text: 'Přihlášky od 1. 5.',
  });
  assert.equal(stavPrihlasky(p('2027-05-01', null), '2027-04-30').stav, 'brzy');
});

// Řádek 3: od vyplněné, dnes < od, rozdíl > 30 dní → planovano
test('planovano: začátek za více než 30 dní', () => {
  assert.deepEqual(stavPrihlasky(p('2027-05-01', '2027-06-15'), '2027-03-31'), {
    stav: 'planovano',
    text: 'Přihlášky od 1. 5. 2027',
  });
});

test('budoucí přihlášky mají přednost před průběžným náborem', () => {
  assert.equal(stavPrihlasky(p('2027-05-01', '2027-06-15', true), '2027-04-20').stav, 'brzy');
});

// Řádek 4: jen do vyplněné a dnes ≤ do → probiha
test('probiha: jen do, dnes ≤ do', () => {
  assert.deepEqual(stavPrihlasky(p(null, '2027-09-30'), '2027-09-01'), {
    stav: 'probiha',
    text: 'Přihlášky do 30. 9.',
  });
  assert.equal(stavPrihlasky(p(null, '2027-09-30'), '2027-09-30').stav, 'probiha');
});

// Řádek 5: prubezne === true → prubezne
test('prubezne: bez termínů', () => {
  assert.deepEqual(stavPrihlasky(p(null, null, true), '2027-01-10'), {
    stav: 'prubezne',
    text: 'Průběžný nábor',
  });
});

test('prubezne má přednost před ukonceno (hlavní nábor skončil)', () => {
  assert.equal(stavPrihlasky(p('2026-09-01', '2026-09-30', true), '2026-10-12').stav, 'prubezne');
  assert.equal(stavPrihlasky(p(null, '2026-09-30', true), '2026-10-12').stav, 'prubezne');
});

// Řádek 6: do vyplněné a dnes > do → ukonceno
test('ukonceno: den po konci', () => {
  assert.deepEqual(stavPrihlasky(p('2027-05-01', '2027-06-15'), '2027-06-16'), {
    stav: 'ukonceno',
    text: 'Přihlášky ukončeny',
  });
  assert.equal(stavPrihlasky(p(null, '2027-06-15'), '2027-06-16').stav, 'ukonceno');
});

// Řádek 7: jinak → neznamy
test('neznamy: nic nevyplněno', () => {
  assert.deepEqual(stavPrihlasky(p(null, null), '2027-01-10'), {
    stav: 'neznamy',
    text: 'Termín přihlášek neuveden',
  });
  assert.equal(stavPrihlasky({}, '2027-01-10').stav, 'neznamy');
  assert.equal(stavPrihlasky(undefined, '2027-01-10').stav, 'neznamy');
});

// Doplněné pravidlo: od v minulosti (nebo dnes), bez do → probiha bez data konce
test('probiha: jen od v minulosti, bez do', () => {
  assert.deepEqual(stavPrihlasky(p('2026-08-26', null), '2026-10-12'), {
    stav: 'probiha',
    text: 'Přihlášky probíhají',
  });
  assert.equal(stavPrihlasky(p('2026-10-12', null), '2026-10-12').stav, 'probiha');
});

test('jen od v minulosti a průběžný nábor → prubezne', () => {
  assert.equal(stavPrihlasky(p('2026-09-02', null, true), '2026-10-12').stav, 'prubezne');
});

// Obsazenost (kapacita) se promítá jen do běžících přihlášek
const pk = (od, doData, kapacita, prubezne = false) => ({ ...p(od, doData, prubezne), kapacita });

test('kapacita obsazeno → obsazeno (probíhající i průběžné)', () => {
  const ocekavane = { stav: 'obsazeno', text: 'Obsazeno' };
  assert.deepEqual(stavPrihlasky(pk('2026-08-26', null, { stav: 'obsazeno' }), '2026-10-27'), ocekavane);
  assert.deepEqual(stavPrihlasky(pk(null, null, { stav: 'obsazeno' }, true), '2026-10-27'), ocekavane);
});

test('kapacita nahradnici → nahradnici', () => {
  assert.deepEqual(stavPrihlasky(pk('2026-08-26', '2026-12-31', { stav: 'nahradnici' }), '2026-10-27'), {
    stav: 'nahradnici',
    text: 'Plno – berou náhradníky',
  });
});

test('kapacita posledni mění jen text', () => {
  const s = (pocet) => stavPrihlasky(pk('2026-08-26', null, { stav: 'posledni', volna_mista: pocet }), '2026-10-27');
  assert.deepEqual(s(1), { stav: 'probiha', text: 'Poslední místo' });
  assert.equal(s(3).text, 'Poslední 3 místa');
  assert.equal(s(5).text, 'Posledních 5 míst');
  assert.equal(s(null).text, 'Poslední místa');
  assert.equal(stavPrihlasky(pk(null, null, { stav: 'posledni', volna_mista: 2 }, true), '2026-10-27').stav, 'prubezne');
});

test('kapacita volno nic nemění', () => {
  assert.deepEqual(stavPrihlasky(pk('2026-08-26', null, { stav: 'volno' }), '2026-10-27'), {
    stav: 'probiha',
    text: 'Přihlášky probíhají',
  });
});

test('kapacita se nepromítá před začátkem a po konci přihlášek', () => {
  const plno = { stav: 'obsazeno' };
  assert.equal(stavPrihlasky(pk('2027-05-01', '2027-06-15', plno), '2027-04-20').stav, 'brzy');
  assert.equal(stavPrihlasky(pk('2027-05-01', '2027-06-15', plno), '2027-01-10').stav, 'planovano');
  assert.equal(stavPrihlasky(pk('2027-05-01', '2027-06-15', plno), '2027-06-16').stav, 'ukonceno');
  assert.equal(stavPrihlasky(pk(null, null, plno), '2027-01-10').stav, 'neznamy');
});

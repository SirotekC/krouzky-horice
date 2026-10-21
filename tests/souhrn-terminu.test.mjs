import { test } from 'node:test';
import assert from 'node:assert/strict';
import { souhrnTerminu } from '../site/js/render.js';

const radek = (den, casy, skupina = null) => ({ skupina, den, casy, misto: null });

test('bez termínů není souhrn', () => {
  assert.equal(souhrnTerminu(null), null);
  assert.equal(souhrnTerminu({ poznamka: 'Termíny upřesníme.' }), null);
});

test('stejný čas ve všech dnech se vypíše jednou', () => {
  const terminy = { rozvrh: [radek('po', ['15:30–16:45']), radek('st', ['15:30–16:45'])] };
  assert.equal(souhrnTerminu(terminy), 'Po, St 15:30–16:45');
});

test('různé časy v nejvýš třech dnech se vypíšou u každého dne', () => {
  const terminy = { rozvrh: [radek('po', ['15:00–16:00']), radek('ct', ['16:00–17:00', '17:00–18:00'])] };
  assert.equal(souhrnTerminu(terminy), 'Po 15:00–16:00, Čt 16:00–17:00 / 17:00–18:00');
});

test('víc dnů s různými časy nebo chybějící časy dají jen dny', () => {
  const ctyri = { rozvrh: ['po', 'ut', 'st', 'ct'].map((d, i) => radek(d, [`1${i}:00–1${i}:45`])) };
  assert.equal(souhrnTerminu(ctyri), 'Po, Út, St, Čt');
  assert.equal(souhrnTerminu({ rozvrh: [radek('pa', [])] }), 'Pá');
});

test('skupiny se shrnou dny a počtem skupin', () => {
  const terminy = {
    rozvrh: [radek('po', ['15:30–16:45'], 'U8'), radek('pa', ['15:30–16:45'], 'U8'), radek('ut', ['16:00–17:30'], 'U10')],
  };
  assert.equal(souhrnTerminu(terminy), 'Po, Út, Pá · 2 skupiny');
  assert.equal(souhrnTerminu({ rozvrh: [radek('so', ['9:00–10:00'], 'Dívky')] }), 'So');
});

test('bez rozvrhu se použije volný text, nebo dny', () => {
  assert.equal(souhrnTerminu({ text: 'Každé úterý odpoledne.' }), 'Každé úterý odpoledne.');
  assert.equal(souhrnTerminu({ dny: ['ut', 'ct'] }), 'Út, Čt');
});

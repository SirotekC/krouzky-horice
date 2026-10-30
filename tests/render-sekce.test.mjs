import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pocetAktivit, pocetKrouzku, textUrcenoPro } from '../site/js/render.js';
import { SEKCE } from '../site/js/sekce.js';

test('textUrcenoPro: první popisek velkým písmenem, další malým', () => {
  assert.equal(textUrcenoPro(['zeny', 'seniori']), 'Ženy, senioři');
  assert.equal(textUrcenoPro(['muzi']), 'Muži');
  assert.equal(textUrcenoPro([]), null);
  assert.equal(textUrcenoPro(undefined), null);
});

test('pocetAktivit podle tvarů sekce', () => {
  assert.equal(pocetAktivit(1, SEKCE.dospeli.tvary), '1 aktivita');
  assert.equal(pocetAktivit(3, SEKCE.dospeli.tvary), '3 aktivity');
  assert.equal(pocetAktivit(12, SEKCE.dospeli.tvary), '12 aktivit');
  assert.equal(pocetKrouzku(3), '3 kroužky');
});

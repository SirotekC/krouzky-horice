import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statistiky } from '../site/js/data.js';
import { pocetKrouzku, sklonuj } from '../site/js/render.js';

test('statistiky počítají kroužky, různé kategorie a organizace s kroužkem', () => {
  const aktivity = [
    { organizace_id: 'zus', kategorie: ['hudba'] },
    { organizace_id: 'zus', kategorie: ['hudba', 'tanec'] },
    { organizace_id: 'sokol', kategorie: ['sport-ostatni'] },
  ];
  assert.deepEqual(statistiky(aktivity), { krouzky: 3, kategorie: 3, organizace: 2 });
});

test('statistiky prázdných dat jsou nulové', () => {
  assert.deepEqual(statistiky([]), { krouzky: 0, kategorie: 0, organizace: 0 });
});

test('sklonuj vybere tvar podle počtu', () => {
  const tvary = ['organizace', 'organizace', 'organizací'];
  assert.equal(sklonuj(1, tvary), 'organizace');
  assert.equal(sklonuj(3, tvary), 'organizace');
  assert.equal(sklonuj(0, tvary), 'organizací');
  assert.equal(sklonuj(10, tvary), 'organizací');
});

test('pocetKrouzku skloňuje beze změny', () => {
  assert.equal(pocetKrouzku(1), '1 kroužek');
  assert.equal(pocetKrouzku(4), '4 kroužky');
  assert.equal(pocetKrouzku(93), '93 kroužků');
});

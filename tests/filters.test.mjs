import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KATEGORIE, pripravData } from '../site/js/data.js';
import { filtruj, jsouPrazdne, normalizuj, prazdneFiltry, seradi } from '../site/js/filters.js';

const DNES = '2026-10-12';
const kontext = { dnes: DNES, kategorie: KATEGORIE };

const organizace = [
  { id: 'zus', nazev: 'Základní umělecká škola' },
  { id: 'sokol', nazev: 'Sokol Hořice' },
];

const prihlaska = (od, doData, prubezne = false) => ({ zpusob: 'x', od, do: doData, prubezne });

const { aktivity } = pripravData(organizace, [
  { id: 'klavir', organizace_id: 'zus', nazev: 'Hra na klavír', kategorie: ['hudba'], vek_od: 7, vek_do: 18,
    prihlaska: prihlaska('2027-05-01', '2027-06-15') },
  { id: 'tanec', organizace_id: 'zus', nazev: 'Taneční obor', popis: 'Současný TANEC', kategorie: ['tanec'], vek_od: 5, vek_do: null,
    prihlaska: prihlaska('2026-10-01', '2026-10-20') },
  { id: 'florbal', organizace_id: 'sokol', nazev: 'Florbal', kategorie: ['sport-mickove'], vek_od: null, vek_do: 12, pohlavi: 'chlapci',
    prihlaska: prihlaska(null, null, true) },
  { id: 'cviceni', organizace_id: 'sokol', nazev: 'Cvičení rodičů s dětmi', kategorie: ['sport-ostatni', 'tanec'], pohlavi: null,
    prihlaska: prihlaska('2026-10-20', '2026-11-30') },
  { id: 'zpev', organizace_id: 'zus', nazev: 'Zpěv', kategorie: ['hudba'], vek_od: 6, vek_do: 18, pohlavi: 'divky',
    prihlaska: prihlaska('2026-06-01', '2026-06-30') },
]);

const ids = (seznam) => seznam.map((a) => a.id).sort();
const f = (zmeny) => ({ ...prazdneFiltry(), ...zmeny });

test('normalizuj odstraní diakritiku a velká písmena', () => {
  assert.equal(normalizuj('Hořice ŽLUŤOUČKÝ kůň'), 'horice zlutoucky kun');
  assert.equal(normalizuj(null), '');
});

test('prázdné filtry vrátí vše', () => {
  assert.equal(filtruj(aktivity, prazdneFiltry(), kontext).length, aktivity.length);
  assert.equal(jsouPrazdne(prazdneFiltry()), true);
  assert.equal(jsouPrazdne(f({ vek: 0 })), false);
});

test('vyhledávání bez diakritiky a velikosti písmen', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'klavir' }), kontext)), ['klavir']);
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'TANEC' }), kontext)), ['cviceni', 'tanec']);
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'tanec' }), kontext)), ['cviceni', 'tanec']);
});

test('vyhledávání v názvu organizace a popiscích kategorií', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'sokol' }), kontext)), ['cviceni', 'florbal']);
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'micove' }), kontext)), ['florbal']);
});

test('vyhledávání více slovy vyžaduje všechna slova', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'sokol florbal' }), kontext)), ['florbal']);
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'sokol klavir' }), kontext)), []);
});

test('filtr věku s chybějícími hranicemi', () => {
  // cviceni nemá věk → vždy odpovídá; florbal má jen vek_do 12; tanec jen vek_od 5.
  assert.deepEqual(ids(filtruj(aktivity, f({ vek: 3 }), kontext)), ['cviceni', 'florbal']);
  assert.deepEqual(ids(filtruj(aktivity, f({ vek: 5 }), kontext)), ['cviceni', 'florbal', 'tanec']);
  assert.deepEqual(ids(filtruj(aktivity, f({ vek: 7 }), kontext)), ['cviceni', 'florbal', 'klavir', 'tanec', 'zpev']);
  assert.deepEqual(ids(filtruj(aktivity, f({ vek: 20 }), kontext)), ['cviceni', 'tanec']);
});

test('kategorie: OR uvnitř skupiny', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ kat: ['hudba', 'sport-mickove'] }), kontext)), ['florbal', 'klavir', 'zpev']);
});

test('skupina kategorií bez upřesnění vybere všechny její kategorie', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ skup: ['sport'] }), kontext)), ['cviceni', 'florbal']);
  assert.deepEqual(ids(filtruj(aktivity, f({ skup: ['umeni'] }), kontext)), ['cviceni', 'klavir', 'tanec', 'zpev']);
  assert.deepEqual(ids(filtruj(aktivity, f({ skup: ['veda'] }), kontext)), []);
  assert.equal(jsouPrazdne(f({ skup: ['sport'] })), false);
});

test('podkategorie zúží vybranou skupinu', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ skup: ['umeni'], kat: ['hudba'] }), kontext)), ['klavir', 'zpev']);
});

test('více skupin: OR mezi skupinami', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ skup: ['sport', 'veda'] }), kontext)), ['cviceni', 'florbal']);
  assert.deepEqual(ids(filtruj(aktivity, f({ skup: ['sport', 'umeni'] }), kontext)), ['cviceni', 'florbal', 'klavir', 'tanec', 'zpev']);
});

test('více skupin: podkategorie zúží jen svou skupinu, ostatní platí celé', () => {
  // Umění zúžené na hudbu, sport celý.
  assert.deepEqual(ids(filtruj(aktivity, f({ skup: ['sport', 'umeni'], kat: ['hudba'] }), kontext)), ['cviceni', 'florbal', 'klavir', 'zpev']);
  // Obě skupiny zúžené.
  assert.deepEqual(ids(filtruj(aktivity, f({ skup: ['sport', 'umeni'], kat: ['hudba', 'sport-mickove'] }), kontext)), ['florbal', 'klavir', 'zpev']);
});

test('vyhledávání v popiscích skupin', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'sport' }), kontext)), ['cviceni', 'florbal']);
});

test('kombinace filtrů: AND mezi skupinami', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ kat: ['tanec', 'hudba'], org: 'zus' }), kontext)), ['klavir', 'tanec', 'zpev']);
  assert.deepEqual(ids(filtruj(aktivity, f({ kat: ['tanec', 'hudba'], org: 'zus', vek: 5 }), kontext)), ['tanec']);
  assert.deepEqual(ids(filtruj(aktivity, f({ kat: ['tanec'], org: 'sokol', q: 'rodicu' }), kontext)), ['cviceni']);
});

test('filtr stavu přihlášek', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ stav: 'probiha' }), kontext)), ['tanec']);
  assert.deepEqual(ids(filtruj(aktivity, f({ stav: 'brzy' }), kontext)), ['cviceni']);
  assert.deepEqual(ids(filtruj(aktivity, f({ stav: 'prubezne' }), kontext)), ['florbal']);
});

test('filtr pohlaví: aktivity pro všechny zůstávají, opačné pohlaví se skryje', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ pohlavi: 'divky' }), kontext)), ['cviceni', 'klavir', 'tanec', 'zpev']);
  assert.deepEqual(ids(filtruj(aktivity, f({ pohlavi: 'chlapci' }), kontext)), ['cviceni', 'florbal', 'klavir', 'tanec']);
  assert.deepEqual(ids(filtruj(aktivity, f({ pohlavi: 'divky', kat: ['hudba'] }), kontext)), ['klavir', 'zpev']);
  assert.equal(jsouPrazdne(f({ pohlavi: 'divky' })), false);
});

test('řazení podle stavu a pak abecedně', () => {
  // probiha: tanec; brzy: cviceni; prubezne: florbal; planovano: klavir; ukonceno: zpev
  assert.deepEqual(seradi(aktivity, DNES).map((a) => a.id), ['tanec', 'cviceni', 'florbal', 'klavir', 'zpev']);
});

test('abecední řazení podle češtiny (ch po h)', () => {
  const p = prihlaska(null, null, true);
  const data = ['Chůze', 'Hokej', 'Cvičení', 'Čeština'].map((nazev, i) => ({ id: `a${i}`, nazev, kategorie: ['ostatni'], prihlaska: p }));
  assert.deepEqual(seradi(data, DNES).map((a) => a.nazev), ['Cvičení', 'Čeština', 'Hokej', 'Chůze']);
});

test('seradi nemění vstupní pole', () => {
  const kopie = [...aktivity];
  seradi(aktivity, DNES);
  assert.deepEqual(aktivity, kopie);
});

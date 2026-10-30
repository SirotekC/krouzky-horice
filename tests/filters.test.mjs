import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KATEGORIE, KATEGORIE_DOSPELI, SKUPINY_KATEGORII_DOSPELI, pripravData } from '../site/js/data.js';
import { dobaZCasu, filtruj, jsouPrazdne, normalizuj, prazdneFiltry, seradi } from '../site/js/filters.js';

const DNES = '2026-10-12';
const kontext = { dnes: DNES, kategorie: KATEGORIE };

const organizace = [
  { id: 'zus', nazev: 'Základní umělecká škola' },
  { id: 'sokol', nazev: 'Sokol Hořice' },
];

const prihlaska = (od, doData, prubezne = false) => ({ zpusob: 'x', od, do: doData, prubezne });

const { aktivity } = pripravData(organizace, [
  { id: 'klavir', organizace_id: 'zus', nazev: 'Hra na klavír', kategorie: ['hudba'], vek_od: 7, vek_do: 18,
    prihlaska: prihlaska('2027-05-01', '2027-06-15'), terminy: null },
  { id: 'tanec', organizace_id: 'zus', nazev: 'Taneční obor', popis: 'Současný TANEC', kategorie: ['tanec'], vek_od: 5, vek_do: null,
    prihlaska: prihlaska('2026-10-01', '2026-10-20'), terminy: { dny: ['po', 'st'] } },
  { id: 'florbal', organizace_id: 'sokol', nazev: 'Florbal', kategorie: ['sport-mickove'], vek_od: null, vek_do: 12, pohlavi: 'chlapci',
    prihlaska: prihlaska(null, null, true), terminy: { dny: ['ut'] } },
  { id: 'cviceni', organizace_id: 'sokol', nazev: 'Cvičení rodičů s dětmi', kategorie: ['sport-ostatni', 'tanec'], pohlavi: null,
    prihlaska: prihlaska('2026-10-20', '2026-11-30'), terminy: { dny: ['st', 'so'] } },
  { id: 'zpev', organizace_id: 'zus', nazev: 'Zpěv', kategorie: ['hudba'], vek_od: 6, vek_do: 18, pohlavi: 'divky', klicova_slova: ['pěvecký sbor', 'zpívání'],
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

test('vyhledávání v klíčových slovech', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'zpivani' }), kontext)), ['zpev']);
  assert.deepEqual(ids(filtruj(aktivity, f({ q: 'Pěvecký' }), kontext)), ['zpev']);
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
  assert.deepEqual(ids(filtruj(aktivity, f({ stav: 'ostatni' }), kontext)), ['klavir', 'zpev']);
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

test('obsazenost: náhradníci mají vlastní filtr, obsazeno patří do „ostatní“ a řadí se před ukončené', () => {
  const s = (id, stav) => ({ id, nazev: id, kategorie: ['ostatni'], prihlaska: { ...prihlaska('2026-08-26', null), kapacita: { stav } } });
  const data = [...aktivity, s('plno', 'obsazeno'), s('nahr', 'nahradnici'), s('volno', 'volno')];
  assert.deepEqual(ids(filtruj(data, f({ stav: 'probiha' }), kontext)), ['tanec', 'volno']);
  assert.deepEqual(ids(filtruj(data, f({ stav: 'nahradnici' }), kontext)), ['nahr']);
  assert.deepEqual(ids(filtruj(data, f({ stav: 'ostatni' }), kontext)), ['klavir', 'plno', 'zpev']);
  assert.deepEqual(seradi(data, DNES).map((a) => a.id), ['tanec', 'volno', 'cviceni', 'florbal', 'nahr', 'klavir', 'plno', 'zpev']);
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

test('filtr dnů: OR mezi dny, aktivity bez pevného dne patří ke každému dni', () => {
  assert.deepEqual(ids(filtruj(aktivity, f({ dny: ['st'] }), kontext)), ['cviceni', 'klavir', 'tanec', 'zpev']);
  assert.deepEqual(ids(filtruj(aktivity, f({ dny: ['ut', 'so'] }), kontext)), ['cviceni', 'florbal', 'klavir', 'zpev']);
  assert.deepEqual(ids(filtruj(aktivity, f({ dny: ['ne'] }), kontext)), ['klavir', 'zpev']);
  assert.equal(jsouPrazdne(f({ dny: ['po'] })), false);
});

test('dobaZCasu: rozhoduje začátek, hranice 9, 12 a 17 hodin', () => {
  assert.equal(dobaZCasu('8:59–10:00'), 'rano');
  assert.equal(dobaZCasu('9:00–10:00'), 'dopoledne');
  assert.equal(dobaZCasu('11:30–13:00'), 'dopoledne');
  assert.equal(dobaZCasu('12:00–13:00'), 'odpoledne');
  assert.equal(dobaZCasu('16:59–18:00'), 'odpoledne');
  assert.equal(dobaZCasu('17:00–18:00'), 'vecer');
  assert.equal(dobaZCasu('x'), null);
});

const dospeli = pripravData(organizace, [
  { id: 'joga-rano', organizace_id: 'sokol', nazev: 'Jóga', kategorie: ['joga'], uroven: 'zacatecnici',
    prihlaska: { ...prihlaska(null, null, true), typ: 'bez-prihlasky' }, terminy: { rozvrh: [{ den: 'po', casy: ['7:00–8:00'] }], dny: ['po'] } },
  { id: 'zumba', organizace_id: 'sokol', nazev: 'Zumba', kategorie: ['cviceni', 'tanec'], uroven: 'vsichni',
    prihlaska: { ...prihlaska(null, null, true), typ: 'rezervace' },
    terminy: { rozvrh: [{ den: 'st', casy: ['10:00–11:00'] }, { den: 'ct', casy: ['18:00–19:00'] }], dny: ['st', 'ct'] } },
  { id: 'anglictina', organizace_id: 'zus', nazev: 'Angličtina', kategorie: ['jazyky'], uroven: 'pokrocili',
    prihlaska: { ...prihlaska('2026-09-01', '2026-10-31'), typ: 'prihlaska' }, terminy: { text: 'Podle domluvy' } },
  { id: 'keramika', organizace_id: 'zus', nazev: 'Keramika', kategorie: ['vytvarne'],
    prihlaska: { ...prihlaska(null, null, true), typ: 'prihlaska' }, terminy: { rozvrh: [{ den: 'po', casy: [] }], dny: ['po'] } },
]).aktivity;
const kontextDospeli = { dnes: DNES, kategorie: KATEGORIE_DOSPELI, skupiny: SKUPINY_KATEGORII_DOSPELI };

test('filtr doby: OR mezi dobami, aktivita bez rozvrhu s časy projde', () => {
  assert.deepEqual(ids(filtruj(dospeli, f({ doba: ['rano'] }), kontextDospeli)), ['anglictina', 'joga-rano', 'keramika']);
  assert.deepEqual(ids(filtruj(dospeli, f({ doba: ['vecer'] }), kontextDospeli)), ['anglictina', 'keramika', 'zumba']);
  assert.deepEqual(ids(filtruj(dospeli, f({ doba: ['rano', 'dopoledne'] }), kontextDospeli)), ['anglictina', 'joga-rano', 'keramika', 'zumba']);
});

test('filtr úrovně: vsichni a bez úrovně projdou', () => {
  assert.deepEqual(ids(filtruj(dospeli, f({ uroven: 'zacatecnici' }), kontextDospeli)), ['joga-rano', 'keramika', 'zumba']);
  assert.deepEqual(ids(filtruj(dospeli, f({ uroven: 'pokrocili' }), kontextDospeli)), ['anglictina', 'keramika', 'zumba']);
});

test('filtr vstupu podle prihlaska.typ', () => {
  assert.deepEqual(ids(filtruj(dospeli, f({ vstup: 'rezervace' }), kontextDospeli)), ['zumba']);
  assert.deepEqual(ids(filtruj(dospeli, f({ vstup: 'prihlaska' }), kontextDospeli)), ['anglictina', 'keramika']);
});

test('skupiny z kontextu: pohyb najde tanec, cvičení i jógu', () => {
  assert.deepEqual(ids(filtruj(dospeli, f({ skup: ['pohyb'] }), kontextDospeli)), ['joga-rano', 'zumba']);
  assert.deepEqual(ids(filtruj(dospeli, f({ q: 'kultura' }), kontextDospeli)), ['keramika']);
});

test('jsouPrazdne bere v úvahu dobu, úroveň a vstup', () => {
  assert.equal(jsouPrazdne(f({ doba: ['rano'] })), false);
  assert.equal(jsouPrazdne(f({ uroven: 'pokrocili' })), false);
  assert.equal(jsouPrazdne(f({ vstup: 'rezervace' })), false);
});

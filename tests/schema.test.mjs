import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vytvorValidatory } from '../scripts/validate.mjs';

const ukazkaOrganizace = {
  id: 'zus-mesto',
  nazev: 'Základní umělecká škola Město',
  typ: 'zus',
  web: 'https://www.zus-mesto.cz',
  email: 'info@zus-mesto.cz',
  telefon: '+420 123 456 789',
  adresa: 'Hlavní 1, 123 45 Město',
  popis: 'Hudební, výtvarný, taneční a literárně-dramatický obor.',
  zdroj_url: 'https://www.zus-mesto.cz/kontakty',
  overeno: '2026-10-09',
};

const ukazkaAktivity = {
  id: 'zus-mesto-klavir',
  organizace_id: 'zus-mesto',
  nazev: 'Hra na klavír',
  kategorie: ['hudba'],
  popis: 'Individuální výuka hry na klavír.',
  vek_od: 7,
  vek_do: 18,
  misto: { nazev: 'Hlavní budova ZUŠ', adresa: 'Hlavní 1, 123 45 Město', gps: null },
  terminy: { text: 'Dle individuálního rozvrhu, Po–Pá odpoledne', dny: ['po', 'ut', 'st', 'ct', 'pa'] },
  cena: { text: '1 800 Kč za pololetí', castka_kc: 1800, obdobi: 'pololeti' },
  prihlaska: {
    zpusob: 'Talentové zkoušky, poté elektronická přihláška.',
    od: '2027-05-01',
    do: '2027-06-15',
    prubezne: false,
    odkaz: 'https://www.zus-mesto.cz/prijimaci-rizeni',
    poznamka: 'Přesné termíny zkoušek škola zveřejňuje v dubnu.',
  },
  skolni_rok: '2026/2027',
  zdroj_url: 'https://www.zus-mesto.cz/hudebni-obor',
  overeno: '2026-10-09',
};

const { organizace, aktivity } = await vytvorValidatory();

test('ukázková organizace projde schématem', () => {
  assert.equal(organizace([ukazkaOrganizace]), true, JSON.stringify(organizace.errors));
});

test('ukázková aktivita projde schématem', () => {
  assert.equal(aktivity([ukazkaAktivity]), true, JSON.stringify(aktivity.errors));
});

test('aktivita s překlepem v názvu pole neprojde', () => {
  const { vek_od, ...zbytek } = ukazkaAktivity;
  assert.equal(aktivity([{ ...zbytek, vek_odd: vek_od }]), false);
});

test('organizace s překlepem v názvu pole neprojde', () => {
  assert.equal(organizace([{ ...ukazkaOrganizace, nazve: 'x' }]), false);
});

test('neplatná kategorie, datum a id neprojdou', () => {
  assert.equal(aktivity([{ ...ukazkaAktivity, kategorie: ['fotbal'] }]), false);
  assert.equal(aktivity([{ ...ukazkaAktivity, overeno: '9. 10. 2026' }]), false);
  assert.equal(aktivity([{ ...ukazkaAktivity, id: 'Klavír' }]), false);
});

test('pohlaví: povolené hodnoty a null', () => {
  assert.equal(aktivity([{ ...ukazkaAktivity, pohlavi: 'divky' }]), true);
  assert.equal(aktivity([{ ...ukazkaAktivity, pohlavi: 'chlapci' }]), true);
  assert.equal(aktivity([{ ...ukazkaAktivity, pohlavi: null }]), true);
  assert.equal(aktivity([{ ...ukazkaAktivity, pohlavi: 'holky' }]), false);
});

test('minimální aktivita s null hodnotami projde', () => {
  const minimalni = {
    id: 'a',
    organizace_id: 'o',
    nazev: 'A',
    kategorie: ['ostatni'],
    vek_od: null,
    vek_do: null,
    misto: null,
    cena: { text: null, castka_kc: null, obdobi: null },
    prihlaska: { zpusob: 'Informace na webu organizace.', prubezne: false, od: null, do: null, odkaz: null },
    skolni_rok: null,
    zdroj_url: 'https://example.cz',
    overeno: '2026-10-09',
  };
  assert.equal(aktivity([minimalni]), true, JSON.stringify(aktivity.errors));
});

test('rozvrh termínů: den je povinný, čas ve tvaru 16:00–16:50', () => {
  const sRozvrhem = (rozvrh) => aktivity([{ ...ukazkaAktivity, terminy: { rozvrh, obdobi: null, poznamka: null } }]);
  assert.equal(sRozvrhem([{ skupina: 'U8', den: 'ut', casy: ['16:00–16:50', '9:00–9:45'], misto: null }]), true);
  assert.equal(sRozvrhem([{ den: 'po', casy: [] }]), true);
  assert.equal(sRozvrhem([{ casy: ['16:00–16:50'] }]), false);
  assert.equal(sRozvrhem([{ den: 'utery' }]), false);
  assert.equal(sRozvrhem([{ den: 'ut', casy: ['16:00-16:50'] }]), false);
  assert.equal(sRozvrhem([]), false);
});

test('období termínů: text, nebo seznam pololetí', () => {
  const sObdobim = (obdobi) => aktivity([{ ...ukazkaAktivity, terminy: { rozvrh: [{ den: 'ut' }], obdobi } }]);
  assert.equal(sObdobim('Podzim 2026'), true);
  assert.equal(sObdobim(null), true);
  assert.equal(sObdobim([{ nazev: '1. pololetí', termin: '29. 9. 2026 – 19. 1. 2027' }]), true);
  assert.equal(sObdobim([{ nazev: '1. pololetí' }]), false);
  assert.equal(sObdobim([]), false);
});

test('klíčová slova: malá písmena s diakritikou, víceslovná, bez duplicit', () => {
  assert.equal(aktivity([{ ...ukazkaAktivity, klicova_slova: ['klavír', 'pěvecký sbor', 'bicí'] }]), true, JSON.stringify(aktivity.errors));
  assert.equal(aktivity([{ ...ukazkaAktivity, klicova_slova: [] }]), true);
  for (const spatne of [['Klavír'], ['Čtení'], [''], [' klavír'], ['klavír,flétna'], ['klavír', 'klavír']]) {
    assert.equal(aktivity([{ ...ukazkaAktivity, klicova_slova: spatne }]), false, JSON.stringify(spatne));
  }
});

test('schéma kontrola: platný soubor projde, neznámé pole a špatné datum neprojdou', async () => {
  const { kontrola } = await vytvorValidatory();
  assert.equal(kontrola({ zdrojeZkontrolovany: '2026-10-25', url: { 'https://a.cz/x': '2026-10-25' } }), true, JSON.stringify(kontrola.errors));
  assert.equal(kontrola({ zdrojeZkontrolovany: null, url: {} }), true);
  assert.equal(kontrola({ zdrojeZkontrolovany: null, url: {}, navic: 1 }), false);
  assert.equal(kontrola({ zdrojeZkontrolovany: '25. 10. 2026', url: {} }), false);
  assert.equal(kontrola({ zdrojeZkontrolovany: null, url: { 'https://a.cz': 'včera' } }), false);
  assert.equal(kontrola({ url: {} }), false);
});
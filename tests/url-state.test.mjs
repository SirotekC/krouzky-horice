import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prazdneFiltry } from '../site/js/filters.js';
import { cestaZHashe, filtryDoUrl, filtryZUrl, odkazNaAktivitu } from '../site/js/url-state.js';

test('převod URL tam a zpět', () => {
  const filtry = { q: 'klavír', vek: 8, dny: ['po', 'st'], skup: ['sport', 'umeni'], kat: ['hudba', 'tanec'], org: 'zus-mesto', stav: 'probiha', pohlavi: 'divky' };
  const url = filtryDoUrl(filtry);
  assert.equal(url, '?q=klav%C3%ADr&vek=8&dny=po,st&skup=sport,umeni&kat=hudba,tanec&org=zus-mesto&stav=probiha&pohlavi=divky');
  assert.deepEqual(filtryZUrl(url), filtry);
});

test('příklad URL ze zadání', () => {
  assert.deepEqual(filtryZUrl('?q=klavir&vek=8&kat=hudba,tanec&org=zus-mesto&stav=probiha'), {
    q: 'klavir', vek: 8, dny: [], skup: ['umeni'], kat: ['hudba', 'tanec'], org: 'zus-mesto', stav: 'probiha', pohlavi: '',
  });
});

test('prázdné filtry dávají prázdný query string', () => {
  assert.equal(filtryDoUrl(prazdneFiltry()), '');
  assert.deepEqual(filtryZUrl(''), prazdneFiltry());
});

test('věk 0 se do URL zapíše', () => {
  assert.equal(filtryDoUrl({ ...prazdneFiltry(), vek: 0 }), '?vek=0');
  assert.equal(filtryZUrl('?vek=0').vek, 0);
});

test('neplatné hodnoty se tiše ignorují', () => {
  assert.deepEqual(filtryZUrl('?vek=abc&kat=hudba,neexistuje&stav=xyz&org=<script>&foo=bar'), {
    ...prazdneFiltry(),
    skup: ['umeni'],
    kat: ['hudba'],
  });
  assert.equal(filtryZUrl('?vek=30').vek, null);
  assert.equal(filtryZUrl('?vek=-1').vek, null);
  assert.equal(filtryZUrl('?stav=ukonceno').stav, '');
  assert.equal(filtryZUrl('?pohlavi=jine').pohlavi, '');
  assert.equal(filtryZUrl('?pohlavi=chlapci').pohlavi, 'chlapci');
});

test('organizace mimo seznam platných se ignoruje', () => {
  assert.equal(filtryZUrl('?org=neznama', ['zus', 'sokol']).org, '');
  assert.equal(filtryZUrl('?org=zus', ['zus', 'sokol']).org, 'zus');
});

test('mezery ve vyhledávání', () => {
  assert.equal(filtryZUrl('?q=hra+na+klav%C3%ADr').q, 'hra na klavír');
  assert.equal(filtryDoUrl({ ...prazdneFiltry(), q: '  ' }), '');
});

test('skupina kategorií a podkategorie mimo skupinu', () => {
  assert.deepEqual(filtryZUrl('?skup=sport').skup, ['sport']);
  assert.deepEqual(filtryZUrl('?skup=neexistuje').skup, []);
  // Podkategorie z nevybrané skupiny se zahodí.
  assert.deepEqual(filtryZUrl('?skup=sport&kat=hudba,plavani'), { ...prazdneFiltry(), skup: ['sport'], kat: ['plavani'] });
  // Starší odkaz bez skupiny: skupiny se odvodí z kategorií.
  assert.deepEqual(filtryZUrl('?kat=plavani,hudba'), { ...prazdneFiltry(), skup: ['sport', 'umeni'], kat: ['plavani', 'hudba'] });
});

test('více skupin v URL: neplatné a duplicitní se zahodí, pořadí podle číselníku', () => {
  assert.deepEqual(filtryZUrl('?skup=ostatni,neexistuje,sport,sport').skup, ['sport', 'ostatni']);
  assert.deepEqual(filtryZUrl('?skup=ostatni,sport&kat=hudba,plavani'), { ...prazdneFiltry(), skup: ['sport', 'ostatni'], kat: ['plavani'] });
  assert.equal(filtryDoUrl({ ...prazdneFiltry(), skup: ['sport', 'ostatni'] }), '?skup=sport,ostatni');
});

test('odkaz na aktivitu tam a zpět', () => {
  assert.equal(odkazNaAktivitu('zus-horice-klavir'), '#/aktivita/zus-horice-klavir');
  assert.deepEqual(cestaZHashe(odkazNaAktivitu('zus-horice-klavir')), { typ: 'aktivita', id: 'zus-horice-klavir' });
  assert.deepEqual(cestaZHashe('#/aktivita/zus-horice-klavir/'), { typ: 'aktivita', id: 'zus-horice-klavir' });
});

test('prázdný hash je seznam, ostatní kotvy zobrazení nemění', () => {
  for (const hash of ['', '#', '#/']) assert.deepEqual(cestaZHashe(hash), { typ: 'seznam' });
  assert.equal(cestaZHashe('#vysledky'), null);
});

test('neplatná cesta nebo id vede na „nenalezeno“', () => {
  for (const hash of ['#/neco', '#/aktivita/', '#/aktivita/<script>', '#/aktivita/%E0%A4%A', '#/aktivita/Velka']) {
    assert.deepEqual(cestaZHashe(hash), { typ: 'aktivita', id: null }, hash);
  }
});

test('dny z URL: neplatné se ignorují, pořadí po → ne', () => {
  assert.deepEqual(filtryZUrl('?dny=st,xx,po,st').dny, ['po', 'st']);
  assert.deepEqual(filtryZUrl('?dny=').dny, []);
});

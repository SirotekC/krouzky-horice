import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prazdneFiltry } from '../site/js/filters.js';
import { filtryDoUrl, filtryZUrl } from '../site/js/url-state.js';

test('převod URL tam a zpět', () => {
  const filtry = { q: 'klavír', vek: 8, skup: 'umeni', kat: ['hudba', 'tanec'], org: 'zus-mesto', stav: 'probiha', pohlavi: 'divky' };
  const url = filtryDoUrl(filtry);
  assert.equal(url, '?q=klav%C3%ADr&vek=8&skup=umeni&kat=hudba,tanec&org=zus-mesto&stav=probiha&pohlavi=divky');
  assert.deepEqual(filtryZUrl(url), filtry);
});

test('příklad URL ze zadání', () => {
  assert.deepEqual(filtryZUrl('?q=klavir&vek=8&kat=hudba,tanec&org=zus-mesto&stav=probiha'), {
    q: 'klavir', vek: 8, skup: 'umeni', kat: ['hudba', 'tanec'], org: 'zus-mesto', stav: 'probiha', pohlavi: '',
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
    skup: 'umeni',
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
  assert.equal(filtryZUrl('?skup=sport').skup, 'sport');
  assert.equal(filtryZUrl('?skup=neexistuje').skup, '');
  // Podkategorie z jiné skupiny se zahodí.
  assert.deepEqual(filtryZUrl('?skup=sport&kat=hudba,plavani'), { ...prazdneFiltry(), skup: 'sport', kat: ['plavani'] });
  // Starší odkaz bez skupiny: skupina se odvodí z první kategorie.
  assert.deepEqual(filtryZUrl('?kat=plavani,hudba'), { ...prazdneFiltry(), skup: 'sport', kat: ['plavani'] });
});

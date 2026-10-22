import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizujUrl, sestavSeznamUrl } from '../scripts/monitor/seznam-url.mjs';

const prazdne = { prehledy: [], doplnkoveUrl: [] };

test('normalizujUrl: fragment, velikost hostname a lomítko jen u kořene', () => {
  assert.equal(normalizujUrl('https://X.cz/#top'), 'https://x.cz');
  assert.equal(normalizujUrl('https://x.cz/'), 'https://x.cz');
  assert.equal(normalizujUrl('https://x.cz/a/'), 'https://x.cz/a/');
  assert.equal(normalizujUrl('https://x.cz/A?q=1#f'), 'https://x.cz/A?q=1');
});

test('zdroj_url je obsah, prihlaska.odkaz a web jen dostupnost', () => {
  const aktivity = [{ id: 'a', zdroj_url: 'https://x.cz/k', prihlaska: { odkaz: 'https://p.cz/1' } }];
  const organizace = [{ id: 'o', web: 'https://x.cz', zdroj_url: 'https://x.cz/kontakt' }];
  const m = sestavSeznamUrl({ aktivity, organizace, nastaveni: prazdne });
  assert.equal(m.get('https://x.cz/k').druh, 'obsah');
  assert.equal(m.get('https://p.cz/1').druh, 'dostupnost');
  assert.equal(m.get('https://x.cz').druh, 'dostupnost');
  assert.equal(m.get('https://x.cz/kontakt').druh, 'obsah');
});

test('stejná URL v obsahu i dostupnosti je jednou jako obsah a má obě použití', () => {
  const aktivity = [
    { id: 'a', zdroj_url: 'https://x.cz/k' },
    { id: 'b', zdroj_url: 'https://jina.cz', prihlaska: { odkaz: 'https://x.cz/k' } },
  ];
  const m = sestavSeznamUrl({ aktivity, organizace: [], nastaveni: prazdne });
  const z = m.get('https://x.cz/k');
  assert.equal(z.druh, 'obsah');
  assert.deepEqual(z.pouziti, [{ id: 'a', pole: 'zdroj_url' }, { id: 'b', pole: 'prihlaska.odkaz' }]);
});

test('URL lišící se #fragmentem nebo koncovým lomítkem kořene se sloučí', () => {
  const aktivity = [{ id: 'a', prihlaska: { odkaz: 'https://X.cz/#top' } }];
  const organizace = [{ id: 'o', web: 'https://x.cz' }];
  const m = sestavSeznamUrl({ aktivity, organizace, nastaveni: prazdne });
  assert.equal(m.size, 1);
  assert.equal(m.get('https://x.cz').pouziti.length, 2);
});

test('přehled s vzorOdkazu má druh prehled a nese vzor', () => {
  const nastaveni = {
    prehledy: [
      { url: 'https://d.cz/krouzky', organizace_id: 'd', vzorOdkazu: '^https://d\\.cz/krouzky/\\d+-' },
      { url: 'https://f.cz/treninky', organizace_id: 'f' },
    ],
    doplnkoveUrl: [],
  };
  const aktivity = [{ id: 'a', zdroj_url: 'https://d.cz/krouzky' }];
  const m = sestavSeznamUrl({ aktivity, organizace: [], nastaveni });
  assert.equal(m.get('https://d.cz/krouzky').druh, 'prehled');
  assert.equal(m.get('https://d.cz/krouzky').vzorOdkazu, '^https://d\\.cz/krouzky/\\d+-');
  assert.equal(m.get('https://f.cz/treninky').druh, 'obsah');
  assert.equal(m.get('https://f.cz/treninky').vzorOdkazu, undefined);
});

test('doplňkové URL jsou obsah s použitím organizace_id a pole "monitor.json"', () => {
  const nastaveni = { prehledy: [], doplnkoveUrl: [{ url: 'https://x.cz/letak.jpg', organizace_id: 'rc', popis: 'leták' }] };
  const m = sestavSeznamUrl({ aktivity: [], organizace: [], nastaveni });
  const z = m.get('https://x.cz/letak.jpg');
  assert.equal(z.druh, 'obsah');
  assert.deepEqual(z.pouziti, [{ id: 'rc', pole: 'monitor.json' }]);
});

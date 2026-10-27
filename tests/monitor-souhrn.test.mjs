import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sestavIssue } from '../scripts/monitor/souhrn.mjs';

const DNES = '2026-10-25';

function nalezy(prepis = {}) {
  return {
    zkontrolovano: 0,
    beZmeny304: 0,
    noveSledovano: 0,
    prepocitano: 0,
    preskoceno: [],
    zmeny: { nove: [], pretrvavajici: [] },
    chyby: { nove: [], pretrvavajici: [] },
    odmitnuto: { nove: [], pretrvavajici: [] },
    prehledy: { nove: [], zrusene: [], pretrvavajici: 0 },
    presmerovani: { nove: [] },
    kapacita: { nove: [], pretrvavajici: [] },
    ...prepis,
  };
}
const pouziti = (id, pole = 'zdroj_url') => [{ id, pole }];
/** Řádek tabulky podle popisku (buňky bez krajních svislítek). */
function radekTabulky(telo, popisek) {
  const radek = telo.split('\n').find((r) => r.startsWith(`| ${popisek} |`));
  assert.ok(radek, `chybí řádek tabulky „${popisek}“`);
  return radek.split('|').slice(1, -1).map((b) => b.trim());
}

test('bez nových problémů: název „… bez nových problémů“, zavrit true, tabulka s počty přetrvávajících', () => {
  const n = nalezy({
    zkontrolovano: 177,
    beZmeny304: 160,
    zmeny: { nove: [], pretrvavajici: [{ url: 'https://a.cz/1', pouziti: pouziti('a-1') }] },
    chyby: {
      nove: [],
      pretrvavajici: [
        { url: 'https://b.cz/x', pouziti: pouziti('b-x', 'prihlaska.odkaz'), druh: '404', status: 404 },
        { url: 'https://c.cz/y', pouziti: pouziti('c'), druh: 'dns', status: null },
      ],
    },
    odmitnuto: { nove: [], pretrvavajici: [{ url: 'https://d.cz/', pouziti: pouziti('d', 'web'), druh: 'odmitnuto', status: 403 }] },
    prehledy: { nove: [], zrusene: [], pretrvavajici: 2 },
    preskoceno: [{ url: 'https://e.cz/z', duvod: 'robots' }],
  });
  const { nazev, telo, zavrit } = sestavIssue(n, DNES);
  assert.equal(nazev, 'Kontrola zdrojů 2026-10-25: bez nových problémů');
  assert.equal(zavrit, true);
  assert.match(telo, /^Zkontrolováno 177 URL\. U 160 z nich server rovnou potvrdil, že se od minulé kontroly nezměnily, takže se nemusely znovu stahovat\./);
  assert.deepEqual(radekTabulky(telo, 'Změněné zdroje'), ['Změněné zdroje', '0', '1']);
  assert.deepEqual(radekTabulky(telo, 'Nefunkční odkazy'), ['Nefunkční odkazy', '0', '2']);
  assert.deepEqual(radekTabulky(telo, 'Server odmítl kontrolu'), ['Server odmítl kontrolu', '0', '1']);
  assert.deepEqual(radekTabulky(telo, 'Nové / zrušené kroužky v přehledech'), ['Nové / zrušené kroužky v přehledech', '0 / 0', '2']);
  assert.deepEqual(radekTabulky(telo, 'Přesměrované odkazy'), ['Přesměrované odkazy', '0', '–']);
  assert.deepEqual(radekTabulky(telo, 'Přeskočeno (robots.txt)'), ['Přeskočeno (robots.txt)', '–', '1']);
  assert.doesNotMatch(telo, /^## Nov/m, 'bez nových položek nejsou sekce nových');
  assert.match(telo, /<details><summary>Přetrvávající problémy \(6\)<\/summary>/);
  for (const u of ['https://a.cz/1', 'https://b.cz/x', 'https://c.cz/y', 'https://d.cz/']) assert.ok(telo.includes(u), u);
  assert.match(telo, /https:\/\/e\.cz\/z/, 'přeskočená URL je v těle uvedená');
  assert.doesNotMatch(telo, /Nově sledováno/, 'nulové počty se nevypisují');
  assert.match(telo, /Vyřešit: napiš agentovi „vyřeš issue #…“\.\s*$/);
});

test('nová změna a nový nefunkční odkaz: název s oběma částmi, sekce s URL a id, zavrit false', () => {
  const n = nalezy({
    zkontrolovano: 3,
    noveSledovano: 4,
    prepocitano: 1,
    zmeny: { nove: [{ url: 'https://www.ddmhorice.cz/krouzky/1000-latino-kids', pouziti: pouziti('ddm-horice-latino-kids') }], pretrvavajici: [] },
    chyby: {
      nove: [{ url: 'https://x.cz/prihlaska', pouziti: [{ id: 'x-a', pole: 'prihlaska.odkaz' }, { id: 'x-b', pole: 'prihlaska.odkaz' }], druh: '404', status: 404 }],
      pretrvavajici: [],
    },
  });
  const { nazev, telo, zavrit } = sestavIssue(n, DNES);
  assert.equal(nazev, 'Kontrola zdrojů 2026-10-25: 1 nová změna, 1 nový nefunkční odkaz');
  assert.equal(zavrit, false);
  assert.match(telo, /## Nové změny zdrojů\n- https:\/\/www\.ddmhorice\.cz\/krouzky\/1000-latino-kids – ddm-horice-latino-kids \(zdroj_url\)\n/);
  assert.match(telo, /## Nové nefunkční odkazy\n- https:\/\/x\.cz\/prihlaska – 404 – x-a \(prihlaska\.odkaz\), x-b \(prihlaska\.odkaz\)\n/);
  assert.match(telo, /Nově sledováno: 4 · přepočítáno po změně pravidel: 1/);
  assert.doesNotMatch(telo, /<details><summary>Přetrvávající/, 'bez přetrvávajících se sekce nevypisuje');
});

test('ostatní nové kategorie: odmítnutí, kroužky v přehledech, přesměrování', () => {
  const n = nalezy({
    odmitnuto: { nove: [{ url: 'https://o.cz/', pouziti: pouziti('o', 'web'), druh: 'odmitnuto', status: 429 }], pretrvavajici: [] },
    prehledy: {
      nove: [{ url: 'https://p.cz/k/2-novy', prehled: 'https://p.cz/k' }, { url: 'https://p.cz/k/3-dalsi', prehled: 'https://p.cz/k' }],
      zrusene: [{ url: 'https://p.cz/k/1-stary', prehled: 'https://p.cz/k' }],
      pretrvavajici: 0,
    },
    presmerovani: { nove: [{ url: 'https://r.cz/a', cil: 'https://r.cz/b', pouziti: pouziti('r') }] },
    chyby: { nove: [{ url: 'https://s.cz/', pouziti: pouziti('s', 'web'), druh: 'dns', status: null }], pretrvavajici: [] },
  });
  const { nazev, telo, zavrit } = sestavIssue(n, DNES);
  assert.equal(nazev, 'Kontrola zdrojů 2026-10-25: 1 nový nefunkční odkaz, 1 nové odmítnutí kontroly, '
    + '2 nové kroužky v přehledech, 1 zrušený kroužek v přehledech, 1 nové přesměrování');
  assert.equal(zavrit, false);
  assert.match(telo, /- https:\/\/s\.cz\/ – dns – s \(web\)/);
  assert.match(telo, /## Server odmítl kontrolu\n- https:\/\/o\.cz\/ – 429 – o \(web\)\n/);
  assert.match(telo, /- nový: https:\/\/p\.cz\/k\/2-novy \(přehled https:\/\/p\.cz\/k\)/);
  assert.match(telo, /- zrušený: https:\/\/p\.cz\/k\/1-stary \(přehled https:\/\/p\.cz\/k\)/);
  assert.match(telo, /## Přesměrované odkazy\n- https:\/\/r\.cz\/a → https:\/\/r\.cz\/b – r \(zdroj_url\)\n/);
  assert.deepEqual(radekTabulky(telo, 'Nové / zrušené kroužky v přehledech'), ['Nové / zrušené kroužky v přehledech', '2 / 1', '0']);
});

test('tělo neobsahuje nic kromě URL, id, polí, kódů a čísel', () => {
  // Do nálezů se přimíchají cizí vlastnosti (jako by v nich byl text stránky). Nesmí se objevit.
  const tajne = { nazev: 'TAJNÝ NÁZEV', text: 'Jan Novák, 777 123 456', email: 'jan@novak.cz' };
  const n = nalezy({
    zkontrolovano: 5,
    beZmeny304: 1,
    noveSledovano: 2,
    prepocitano: 1,
    zmeny: {
      nove: [{ url: 'https://a.cz/1', pouziti: [{ id: 'a-1', pole: 'zdroj_url', ...tajne }], ...tajne }],
      pretrvavajici: [{ url: 'https://a.cz/2', pouziti: pouziti('a-2'), ...tajne }],
    },
    chyby: {
      nove: [{ url: 'https://b.cz/x', pouziti: pouziti('b-x', 'prihlaska.odkaz'), druh: '404', status: 404, ...tajne }],
      pretrvavajici: [{ url: 'https://b.cz/y', pouziti: pouziti('b-y'), druh: 'timeout', status: null, ...tajne }],
    },
    odmitnuto: { nove: [{ url: 'https://d.cz/', pouziti: pouziti('d-1', 'web'), druh: 'odmitnuto', status: 403, ...tajne }], pretrvavajici: [] },
    prehledy: { nove: [{ url: 'https://p.cz/k/2', prehled: 'https://p.cz/k', ...tajne }], zrusene: [{ url: 'https://p.cz/k/1', prehled: 'https://p.cz/k' }], pretrvavajici: 1 },
    presmerovani: { nove: [{ url: 'https://r.cz/a', cil: 'https://r.cz/b', pouziti: pouziti('r-1'), ...tajne }] },
    preskoceno: [{ url: 'https://e.cz/z', duvod: 'robots', ...tajne }],
  });
  const { nazev, telo } = sestavIssue(n, DNES);
  for (const text of [nazev, telo]) {
    for (const hodnota of Object.values(tajne)) assert.ok(!text.includes(hodnota), `objevilo se „${hodnota}“`);
  }

  // Po odstranění URL, id a polí ze vstupu zůstanou jen čísla, data a slova šablony.
  let zbytek = telo;
  const povolene = ['https://a.cz/1', 'https://a.cz/2', 'https://b.cz/x', 'https://b.cz/y', 'https://d.cz/', 'https://p.cz/k/2',
    'https://p.cz/k/1', 'https://p.cz/k', 'https://r.cz/a', 'https://r.cz/b', 'https://e.cz/z',
    'prihlaska.odkaz', 'zdroj_url', 'web', 'a-1', 'a-2', 'b-x', 'b-y', 'r-1', 'd-1'];
  for (const p of povolene.sort((x, y) => y.length - x.length)) zbytek = zbytek.split(p).join(' ');
  const SABLONA = new Set(`Zkontrolováno URL U z nich server rovnou potvrdil že se od minulé kontroly nezměnily takže nemusely znovu stahovat
    Nelze kontrolovat viz monitor.json nové přetrvávající Změněné zdroje Nefunkční odkazy
    Server odmítl kontrolu Nové zrušené kroužky v přehledech Přesměrované Přeskočeno robots.txt robots nedostupný
    Nově sledováno přepočítáno po změně pravidel Nové změny zdrojů a nefunkční nový zrušený přehled
    Přetrvávající problémy details summary změna nefunkční odmítnuto nevyřešené kroužky
    Vyřešit napiš agentovi vyřeš issue timeout odmitnuto nedostupny Rozdíly obsazenosti volná místa`.split(/\s+/).filter(Boolean));
  const slova = zbytek.match(/\p{L}[\p{L}.]*/gu) ?? [];
  const cizi = slova.filter((s) => !SABLONA.has(s.replace(/\.$/, '')));
  assert.deepEqual(cizi, [], `neočekávaná slova: ${cizi.join(', ')}`);
});

test('české tvary: 1 nová změna, 2 nové změny, 5 nových změn', () => {
  const zmeny = (k) => ({ nove: Array.from({ length: k }, (_, i) => ({ url: `https://a.cz/${i}`, pouziti: pouziti(`a-${i}`) })), pretrvavajici: [] });
  const chyby = (k) => ({ nove: Array.from({ length: k }, (_, i) => ({ url: `https://b.cz/${i}`, pouziti: pouziti(`b-${i}`), druh: '404', status: 404 })), pretrvavajici: [] });
  assert.equal(sestavIssue(nalezy({ zmeny: zmeny(1) }), DNES).nazev, 'Kontrola zdrojů 2026-10-25: 1 nová změna');
  assert.equal(sestavIssue(nalezy({ zmeny: zmeny(2) }), DNES).nazev, 'Kontrola zdrojů 2026-10-25: 2 nové změny');
  assert.equal(sestavIssue(nalezy({ zmeny: zmeny(5) }), DNES).nazev, 'Kontrola zdrojů 2026-10-25: 5 nových změn');
  assert.equal(sestavIssue(nalezy({ chyby: chyby(4) }), DNES).nazev, 'Kontrola zdrojů 2026-10-25: 4 nové nefunkční odkazy');
  assert.equal(sestavIssue(nalezy({ chyby: chyby(5) }), DNES).nazev, 'Kontrola zdrojů 2026-10-25: 5 nových nefunkčních odkazů');
});

test('rozdíly v obsazenosti: název, tabulka, sekce s id a hodnotami, přetrvávající v detailu', () => {
  const n = nalezy({
    kapacita: {
      nove: [{ url: 'https://ddm.cz/k/1', web: { stav: 'volno' }, rozdily: [{ id: 'ddm-a', data: { stav: 'obsazeno' } }] }],
      pretrvavajici: [{ url: 'https://ddm.cz/k/2', web: { stav: 'posledni', volna_mista: 2 }, rozdily: [{ id: 'ddm-b', data: null }] }],
    },
  });
  const { nazev, telo, zavrit } = sestavIssue(n, DNES);
  assert.equal(nazev, 'Kontrola zdrojů 2026-10-25: 1 nový rozdíl v obsazenosti');
  assert.equal(zavrit, false);
  assert.deepEqual(radekTabulky(telo, 'Rozdíly v obsazenosti (volná místa)'), ['Rozdíly v obsazenosti (volná místa)', '1', '1']);
  assert.ok(telo.includes('## Nové rozdíly v obsazenosti\n- ddm-a – web: volno, data: obsazeno – https://ddm.cz/k/1\n'));
  assert.ok(telo.includes('- ddm-b – obsazenost – web: poslední 2 místa, data: neuvedeno – https://ddm.cz/k/2'));
});

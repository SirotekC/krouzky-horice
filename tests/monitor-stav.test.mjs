import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prazdnyStav, vyhodnotBeh, potvrd } from '../scripts/monitor/stav.mjs';

const U = 'https://x.cz/k';
const P = 'https://x.cz/krouzky';
const VP = 'v1';
const POUZITI = [{ id: 'a', pole: 'zdroj_url' }];

/** Úspěšný výsledek stahování (tvar z úkolu 4). */
function ok(prepis = {}) {
  return {
    status: 200, beZmeny: false, telo: null, contentType: 'text/html',
    etag: '"e2"', lastModified: null, konecnaUrl: U, trvalePresmerovano: false, chyba: null,
    ...prepis,
  };
}
function chyba(druh, status = null, prepis = {}) {
  return ok({ status, etag: '"chybny"', chyba: { druh, status }, ...prepis });
}
function mereni(prepis = {}) {
  return { vysledek: ok(), otisk: 'aaa', odkazy: null, verzePravidel: VP, preskoceno: null, ...prepis };
}
/** Uložený záznam druhu obsah, výchozí stav: vše potvrzeno, bez problémů. */
function zaznam(prepis = {}) {
  return {
    druh: 'obsah',
    otiskPotvrzeny: 'aaa', otiskPosledni: 'aaa',
    verzePravidel: VP, etag: '"e1"', lastModified: null,
    posledniKontrola: '2026-10-19', posledniOk: '2026-10-19',
    zmena: null, chyba: null, presmerovani: null,
    ...prepis,
  };
}
function stav(url = {}, prepis = {}) {
  return { verze: 1, posledniBeh: '2026-10-19', zapatiDatum: '2026-10-19', url, ...prepis };
}
function seznam(polozky = { [U]: { druh: 'obsah', pouziti: POUZITI } }) {
  return new Map(Object.entries(polozky));
}
function beh({ predchozi = stav(), sez = seznam(), mer = {}, ignorovane = [], znameZdroje = new Set(), dnes = '2026-10-22' } = {}) {
  return vyhodnotBeh({ predchozi, seznam: sez, mereni: new Map(Object.entries(mer)), ignorovane, znameZdroje, dnes });
}

const PREHLED = { [P]: { druh: 'prehled', pouziti: [{ id: 'org', pole: 'prehled' }], vzorOdkazu: '^https://x\\.cz/krouzky/\\d+' } };
function zaznamPrehledu(prepis = {}) {
  return zaznam({
    druh: 'prehled', otiskPotvrzeny: 'ppp', otiskPosledni: 'ppp',
    odkazyPotvrzene: ['https://x.cz/krouzky/1', 'https://x.cz/krouzky/2'],
    odkazyPosledni: ['https://x.cz/krouzky/1', 'https://x.cz/krouzky/2'],
    ...prepis,
  });
}

test('prazdnyStav', () => {
  assert.deepEqual(prazdnyStav(), { verze: 1, posledniBeh: null, zapatiDatum: null, url: {} });
});

test('1: nová URL se uloží jako potvrzená a nic se nehlásí', () => {
  const { stav: s, nalezy } = beh({ predchozi: prazdnyStav(), mer: { [U]: mereni({ otisk: 'bbb' }) } });
  const z = s.url[U];
  assert.equal(z.druh, 'obsah');
  assert.equal(z.otiskPotvrzeny, 'bbb');
  assert.equal(z.otiskPosledni, 'bbb');
  assert.equal(z.posledniOk, '2026-10-22');
  assert.equal(z.posledniKontrola, '2026-10-22');
  assert.equal(z.etag, '"e2"');
  assert.equal(z.zmena, null);
  assert.equal(z.chyba, null);
  assert.equal(nalezy.noveSledovano, 1);
  assert.equal(nalezy.prepocitano, 0);
  assert.equal(nalezy.zkontrolovano, 1);
  assert.deepEqual(nalezy.zmeny, { nove: [], pretrvavajici: [] });
  assert.deepEqual(nalezy.prehledy.nove, []);

  // nový přehled s odkazy: odkazy se uloží jako potvrzené, nic se nehlásí
  const odkazy = ['https://x.cz/krouzky/9'];
  const r = beh({ predchozi: prazdnyStav(), sez: seznam(PREHLED), mer: { [P]: mereni({ otisk: 'p', odkazy }) } });
  assert.deepEqual(r.stav.url[P].odkazyPotvrzene, odkazy);
  assert.deepEqual(r.stav.url[P].odkazyPosledni, odkazy);
  assert.deepEqual(r.nalezy.prehledy.nove, []);
  assert.equal(r.nalezy.noveSledovano, 1);
});

test('2: změna verze pravidel přepočítá a potvrdí bez hlášení', () => {
  const predchozi = stav({ [U]: zaznam({ zmena: { od: '2026-10-19', otisk: 'ccc' }, otiskPosledni: 'ccc', verzePravidel: 'v0' }) });
  const { stav: s, nalezy } = beh({ predchozi, mer: { [U]: mereni({ otisk: 'ddd' }) } });
  const z = s.url[U];
  assert.equal(z.otiskPotvrzeny, 'ddd');
  assert.equal(z.otiskPosledni, 'ddd');
  assert.equal(z.verzePravidel, VP);
  assert.equal(z.zmena, null);
  assert.equal(z.posledniOk, '2026-10-22');
  assert.equal(nalezy.prepocitano, 1);
  assert.equal(nalezy.noveSledovano, 0);
  assert.deepEqual(nalezy.zmeny.nove, []);

  // 304 po změně pravidel nedá otisk: přepočet se odloží, validátory se smažou
  const vysledek = ok({ status: 304, beZmeny: true, etag: null });
  const r = beh({ predchozi: stav({ [U]: zaznam({ verzePravidel: 'v0' }) }), mer: { [U]: mereni({ vysledek, otisk: null }) } });
  assert.equal(r.stav.url[U].verzePravidel, 'v0');
  assert.equal(r.stav.url[U].etag, null);
  assert.equal(r.nalezy.prepocitano, 0);
});

test('3: při 304 se poslední otisk ani stav změny nemění', () => {
  const zmena = { od: '2026-10-19', otisk: 'ccc' };
  const predchozi = stav({ [U]: zaznam({ otiskPosledni: 'ccc', zmena }) });
  const vysledek = ok({ status: 304, beZmeny: true, etag: null });
  const { stav: s, nalezy } = beh({ predchozi, mer: { [U]: mereni({ vysledek, otisk: null }) } });
  const z = s.url[U];
  assert.equal(z.otiskPosledni, 'ccc');
  assert.deepEqual(z.zmena, zmena);
  assert.equal(z.etag, '"e1"', '304 bez ETag zachová uložený');
  assert.equal(nalezy.beZmeny304, 1);
  assert.equal(nalezy.zmeny.pretrvavajici.length, 1);
  assert.equal(nalezy.zmeny.nove.length, 0);

  // 304 u potvrzeného zdroje: beze změny, posledniOk se posune
  const r = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni({ vysledek, otisk: null }) } });
  assert.equal(r.stav.url[U].otiskPosledni, 'aaa');
  assert.equal(r.stav.url[U].zmena, null);
  assert.equal(r.stav.url[U].posledniOk, '2026-10-22');
});

test('4: druhý běh se stejnou změnou je přetrvávající', () => {
  // první běh se změnou → nová
  const r1 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni({ otisk: 'bbb' }) } });
  assert.deepEqual(r1.stav.url[U].zmena, { od: '2026-10-22', otisk: 'bbb' });
  assert.equal(r1.stav.url[U].otiskPosledni, 'bbb');
  assert.equal(r1.stav.url[U].otiskPotvrzeny, 'aaa');
  assert.deepEqual(r1.nalezy.zmeny.nove, [{ url: U, pouziti: POUZITI }]);
  assert.deepEqual(r1.nalezy.zmeny.pretrvavajici, []);

  // druhý běh se stejným otiskem → přetrvávající
  const r2 = beh({ predchozi: r1.stav, mer: { [U]: mereni({ otisk: 'bbb' }) }, dnes: '2026-10-25' });
  assert.deepEqual(r2.stav.url[U].zmena, { od: '2026-10-22', otisk: 'bbb' });
  assert.deepEqual(r2.nalezy.zmeny.nove, []);
  assert.deepEqual(r2.nalezy.zmeny.pretrvavajici, [{ url: U, pouziti: POUZITI }]);

  // další změna → opět nová, `od` se zachová
  const r3 = beh({ predchozi: r2.stav, mer: { [U]: mereni({ otisk: 'ccc' }) }, dnes: '2026-10-28' });
  assert.deepEqual(r3.stav.url[U].zmena, { od: '2026-10-22', otisk: 'ccc' });
  assert.equal(r3.nalezy.zmeny.nove.length, 1);

  // stránka se vrátila k potvrzenému otisku → změna zmizí
  const r4 = beh({ predchozi: r3.stav, mer: { [U]: mereni({ otisk: 'aaa' }) }, dnes: '2026-10-31' });
  assert.equal(r4.stav.url[U].zmena, null);
  assert.equal(r4.nalezy.zmeny.nove.length + r4.nalezy.zmeny.pretrvavajici.length, 0);
});

test('5: chyba se hlásí až podruhé po sobě, odmítnutí zvlášť, úspěch ji smaže', () => {
  const zaznamPred = zaznam();
  const r1 = beh({ predchozi: stav({ [U]: zaznamPred }), mer: { [U]: mereni({ vysledek: chyba('404', 404), otisk: null }) } });
  assert.deepEqual(r1.stav.url[U].chyba, { druh: '404', status: 404, od: '2026-10-22', pocet: 1 });
  assert.deepEqual(r1.nalezy.chyby, { nove: [], pretrvavajici: [] });
  assert.equal(r1.stav.url[U].etag, '"e1"', 'validátory z chybové odpovědi se neukládají');
  assert.equal(r1.stav.url[U].posledniOk, '2026-10-19');
  assert.equal(r1.stav.url[U].otiskPosledni, 'aaa');

  const r2 = beh({ predchozi: r1.stav, mer: { [U]: mereni({ vysledek: chyba('404', 404), otisk: null }) }, dnes: '2026-10-25' });
  assert.deepEqual(r2.stav.url[U].chyba, { druh: '404', status: 404, od: '2026-10-22', pocet: 2 });
  assert.deepEqual(r2.nalezy.chyby.nove, [{ url: U, pouziti: POUZITI, druh: '404', status: 404 }]);

  const r3 = beh({ predchozi: r2.stav, mer: { [U]: mereni({ vysledek: chyba('404', 404), otisk: null }) }, dnes: '2026-10-28' });
  assert.equal(r3.stav.url[U].chyba.pocet, 3);
  assert.deepEqual(r3.nalezy.chyby.nove, []);
  assert.equal(r3.nalezy.chyby.pretrvavajici.length, 1);

  // 404 ×3 a pak 410: stejná kategorie, dál přetrvávající, `od` z prvního neúspěchu
  const r4 = beh({ predchozi: r3.stav, mer: { [U]: mereni({ vysledek: chyba('410', 410), otisk: null }) }, dnes: '2026-10-31' });
  assert.deepEqual(r4.stav.url[U].chyba, { druh: '410', status: 410, od: '2026-10-22', pocet: 4 });
  assert.deepEqual(r4.nalezy.chyby.nove, []);
  assert.deepEqual(r4.nalezy.chyby.pretrvavajici, [{ url: U, pouziti: POUZITI, druh: '410', status: 410 }]);

  // přechod mezi kategoriemi (nefunkční → odmítnuto) začíná novou sérii
  const r4b = beh({ predchozi: r3.stav, mer: { [U]: mereni({ vysledek: chyba('odmitnuto', 429), otisk: null }) }, dnes: '2026-10-31' });
  assert.deepEqual(r4b.stav.url[U].chyba, { druh: 'odmitnuto', status: 429, od: '2026-10-31', pocet: 1 });
  assert.deepEqual(r4b.nalezy.odmitnuto, { nove: [], pretrvavajici: [] });

  // úspěch chybu smaže
  const r5 = beh({ predchozi: r3.stav, mer: { [U]: mereni() }, dnes: '2026-10-31' });
  assert.equal(r5.stav.url[U].chyba, null);
  assert.equal(r5.stav.url[U].posledniOk, '2026-10-31');

  // odmítnuto se hlásí do vlastní skupiny
  const o1 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni({ vysledek: chyba('odmitnuto', 403), otisk: null }) } });
  const o2 = beh({ predchozi: o1.stav, mer: { [U]: mereni({ vysledek: chyba('odmitnuto', 403), otisk: null }) }, dnes: '2026-10-25' });
  assert.deepEqual(o2.nalezy.odmitnuto.nove, [{ url: U, pouziti: POUZITI, druh: 'odmitnuto', status: 403 }]);
  assert.deepEqual(o2.nalezy.chyby, { nove: [], pretrvavajici: [] });
});

test('5: 5xx a pak timeout je druhý neúspěch po sobě a hlásí se jako nový', () => {
  const r1 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni({ vysledek: chyba('5xx', 503), otisk: null }) } });
  assert.deepEqual(r1.nalezy.chyby.nove, []);
  const r2 = beh({ predchozi: r1.stav, mer: { [U]: mereni({ vysledek: chyba('timeout'), otisk: null }) }, dnes: '2026-10-25' });
  assert.deepEqual(r2.stav.url[U].chyba, { druh: 'timeout', status: null, od: '2026-10-22', pocet: 2 });
  assert.deepEqual(r2.nalezy.chyby.nove, [{ url: U, pouziti: POUZITI, druh: 'timeout', status: null }]);
});

test('5: nevyřešená změna u URL s chybou se dál počítá jako přetrvávající', () => {
  const pred = zaznam({ otiskPosledni: 'bbb', zmena: { od: '2026-10-19', otisk: 'bbb' } });
  const { stav: s, nalezy } = beh({ predchozi: stav({ [U]: pred }), mer: { [U]: mereni({ vysledek: chyba('5xx', 500), otisk: null }) } });
  assert.deepEqual(s.url[U].zmena, { od: '2026-10-19', otisk: 'bbb' });
  assert.deepEqual(nalezy.zmeny.pretrvavajici, [{ url: U, pouziti: POUZITI }]);
  assert.deepEqual(nalezy.zmeny.nove, []);
});

test('6: přehled hlásí nové a zrušené odkazy, opakované jen jako počet', () => {
  const predchozi = stav({ [P]: zaznamPrehledu() });
  const odkazy = [
    'https://x.cz/krouzky/1',            // potvrzený
    'https://x.cz/krouzky/3',            // nový
    'https://x.cz/krouzky/4-dospeli',    // ignorovaný
    'https://x.cz/krouzky/5',            // už je v datech
  ];
  const vstup = {
    predchozi, sez: seznam(PREHLED),
    ignorovane: ['https://x.cz/krouzky/4-dospeli'],
    znameZdroje: new Set(['https://x.cz/krouzky/5']),
  };
  const r1 = beh({ ...vstup, mer: { [P]: mereni({ otisk: 'ppp2', odkazy }) } });
  assert.deepEqual(r1.nalezy.prehledy.nove, [{ url: 'https://x.cz/krouzky/3', prehled: P }]);
  assert.deepEqual(r1.nalezy.prehledy.zrusene, [{ url: 'https://x.cz/krouzky/2', prehled: P }]);
  assert.equal(r1.nalezy.prehledy.pretrvavajici, 0);
  assert.deepEqual(r1.stav.url[P].odkazyPotvrzene, ['https://x.cz/krouzky/1', 'https://x.cz/krouzky/2']);
  assert.deepEqual(r1.stav.url[P].odkazyPosledni, odkazy);
  assert.equal(r1.stav.url[P].zmena, null, 'přehled s odkazy nehlásí změnu textu');
  assert.deepEqual(r1.nalezy.zmeny.nove, []);

  // další běh se stejnými odkazy → přetrvávající, jen počet
  const r2 = beh({ ...vstup, predchozi: r1.stav, mer: { [P]: mereni({ otisk: 'ppp2', odkazy }) }, dnes: '2026-10-25' });
  assert.deepEqual(r2.nalezy.prehledy.nove, []);
  assert.deepEqual(r2.nalezy.prehledy.zrusene, []);
  assert.equal(r2.nalezy.prehledy.pretrvavajici, 2);

  // bez nových i zrušených (jen ignorované a známé navíc) → potvrzené = odkazy
  const bezNovych = ['https://x.cz/krouzky/1', 'https://x.cz/krouzky/2', 'https://x.cz/krouzky/4-dospeli', 'https://x.cz/krouzky/5'];
  const r3 = beh({ ...vstup, mer: { [P]: mereni({ otisk: 'ppp2', odkazy: bezNovych }) } });
  assert.deepEqual(r3.stav.url[P].odkazyPotvrzene, bezNovych);
  assert.equal(r3.nalezy.prehledy.pretrvavajici, 0);
});

test('7: posledniOk se posune jen bez chyby a bez nevyřešené změny', () => {
  const r1 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni() } });
  assert.equal(r1.stav.url[U].posledniOk, '2026-10-22');

  const r2 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni({ otisk: 'bbb' }) } });
  assert.equal(r2.stav.url[U].posledniOk, '2026-10-19', 'nevyřešená změna');

  const r3 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni({ vysledek: chyba('5xx', 503), otisk: null }) } });
  assert.equal(r3.stav.url[U].posledniOk, '2026-10-19', 'chyba');

  // dostupnost: stačí úspěch
  const D = 'https://p.cz/prihlaska';
  const sez = seznam({ [D]: { druh: 'dostupnost', pouziti: [{ id: 'a', pole: 'prihlaska.odkaz' }] } });
  const predD = stav({ [D]: zaznam({ druh: 'dostupnost', otiskPotvrzeny: null, otiskPosledni: null }) });
  const r4 = beh({ predchozi: predD, sez, mer: { [D]: mereni({ otisk: null, vysledek: ok({ konecnaUrl: D }) }) } });
  assert.equal(r4.stav.url[D].posledniOk, '2026-10-22');
  assert.equal(r4.stav.url[D].zmena, null);
});

test('8: trvalé přesměrování se uloží a hlásí jen při změně cíle', () => {
  const cil = 'https://x.cz/prehled';
  const vysledek = ok({ konecnaUrl: cil, trvalePresmerovano: true });
  const r1 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni({ vysledek }) } });
  assert.equal(r1.stav.url[U].presmerovani, cil);
  assert.deepEqual(r1.nalezy.presmerovani.nove, [{ url: U, pouziti: POUZITI, cil }]);

  const r2 = beh({ predchozi: r1.stav, mer: { [U]: mereni({ vysledek }) }, dnes: '2026-10-25' });
  assert.equal(r2.stav.url[U].presmerovani, cil);
  assert.deepEqual(r2.nalezy.presmerovani.nove, []);

  // přesměrování zmizelo
  const r3 = beh({ predchozi: r2.stav, mer: { [U]: mereni() }, dnes: '2026-10-28' });
  assert.equal(r3.stav.url[U].presmerovani, null);
});

test('9: URL, která není v seznamu, se ze stavu odstraní', () => {
  const predchozi = stav({ [U]: zaznam(), 'https://stara.cz': zaznam() });
  const { stav: s } = beh({ predchozi, mer: { [U]: mereni() } });
  assert.deepEqual(Object.keys(s.url), [U]);
});

test('10: datum v zápatí se posune jen bez nevyřešených změn', () => {
  const r1 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni() } });
  assert.equal(r1.stav.zapatiDatum, '2026-10-22');
  assert.equal(r1.stav.posledniBeh, '2026-10-22');

  const r2 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni({ otisk: 'bbb' }) } });
  assert.equal(r2.stav.zapatiDatum, '2026-10-19');
  assert.equal(r2.stav.posledniBeh, '2026-10-22');

  // nevyřešené nové odkazy v přehledu
  const odkazy = ['https://x.cz/krouzky/1', 'https://x.cz/krouzky/2', 'https://x.cz/krouzky/3'];
  const r3 = beh({ predchozi: stav({ [P]: zaznamPrehledu() }), sez: seznam(PREHLED), mer: { [P]: mereni({ otisk: 'p', odkazy }) } });
  assert.equal(r3.stav.zapatiDatum, '2026-10-19');

  // nevyřešená změna u přeskočené URL taky brání posunu
  const pred = stav({ [U]: zaznam({ otiskPosledni: 'bbb', zmena: { od: '2026-10-19', otisk: 'bbb' } }) });
  const r4 = beh({ predchozi: pred, mer: { [U]: mereni({ vysledek: null, otisk: null, preskoceno: 'robots' }) } });
  assert.equal(r4.stav.zapatiDatum, '2026-10-19');

  // chyba datum v zápatí neblokuje
  const r5 = beh({ predchozi: stav({ [U]: zaznam() }), mer: { [U]: mereni({ vysledek: chyba('dns'), otisk: null }) } });
  assert.equal(r5.stav.zapatiDatum, '2026-10-22');
});

test('11: přeskočená URL změní jen posledniKontrola a jde do nalezy.preskoceno', () => {
  const pred = zaznam({ otiskPosledni: 'bbb', zmena: { od: '2026-10-19', otisk: 'bbb' } });
  const { stav: s, nalezy } = beh({
    predchozi: stav({ [U]: pred }),
    mer: { [U]: mereni({ vysledek: null, otisk: null, preskoceno: 'robots-nedostupny' }) },
  });
  assert.deepEqual(s.url[U], { ...pred, posledniKontrola: '2026-10-22' });
  assert.deepEqual(nalezy.preskoceno, [{ url: U, duvod: 'robots-nedostupny' }]);
  assert.equal(nalezy.zkontrolovano, 0);
  assert.deepEqual(nalezy.zmeny, { nove: [], pretrvavajici: [] });
});

test('potvrd přenese poslední otisk a odkazy a vynuluje změnu', () => {
  const s = stav({
    [U]: zaznam({ otiskPosledni: 'bbb', zmena: { od: '2026-10-19', otisk: 'bbb' }, posledniOk: '2026-10-10' }),
    [P]: zaznamPrehledu({ odkazyPosledni: ['https://x.cz/krouzky/1', 'https://x.cz/krouzky/3'] }),
  });
  const jen = potvrd(s, [U], '2026-10-23');
  assert.equal(jen.url[U].otiskPotvrzeny, 'bbb');
  assert.equal(jen.url[U].zmena, null);
  assert.equal(jen.url[U].posledniOk, '2026-10-23');
  assert.deepEqual(jen.url[P], s.url[P], 'nepotvrzená URL se nemění');
  assert.equal(s.url[U].otiskPotvrzeny, 'aaa', 'vstup se nemutuje');

  const vse = potvrd(s, 'vse', '2026-10-23');
  assert.deepEqual(vse.url[P].odkazyPotvrzene, ['https://x.cz/krouzky/1', 'https://x.cz/krouzky/3']);
  assert.equal(vse.url[P].posledniOk, '2026-10-23');
});

test('potvrd neposune posledniOk u URL s chybou nebo bez otisku', () => {
  const C = 'https://x.cz/chyba';
  const N = 'https://x.cz/nova';
  const s = stav({
    [C]: zaznam({ otiskPosledni: 'bbb', zmena: { od: '2026-10-19', otisk: 'bbb' }, chyba: { druh: '404', status: 404, od: '2026-10-19', pocet: 2 } }),
    [N]: zaznam({ otiskPotvrzeny: null, otiskPosledni: null, posledniOk: null, chyba: { druh: 'dns', status: null, od: '2026-10-19', pocet: 1 } }),
    [U]: zaznam({ otiskPosledni: 'ccc', zmena: { od: '2026-10-19', otisk: 'ccc' }, posledniOk: '2026-10-10' }),
  });
  const p = potvrd(s, 'vse', '2026-10-23');
  assert.equal(p.url[C].otiskPotvrzeny, 'bbb');
  assert.equal(p.url[C].zmena, null);
  assert.equal(p.url[C].posledniOk, '2026-10-19', 'URL s chybou');
  assert.equal(p.url[N].posledniOk, null, 'URL bez otisku');
  assert.equal(p.url[U].posledniOk, '2026-10-23');
});

test('potvrd posune zapatiDatum, jen když nic nevyřešeného nezůstane', () => {
  const zmena = (o) => zaznam({ otiskPosledni: o, zmena: { od: '2026-10-19', otisk: o } });
  const s = stav({ [U]: zmena('bbb'), 'https://x.cz/dalsi': zmena('ccc') });

  const castecne = potvrd(s, [U], '2026-10-23');
  assert.equal(castecne.zapatiDatum, '2026-10-19');

  const vse = potvrd(s, 'vse', '2026-10-23');
  assert.equal(vse.zapatiDatum, '2026-10-23');

  // nevyřešený nový odkaz přehledu blokuje, ignorovaný ne
  const sPrehled = stav({
    [U]: zmena('bbb'),
    [P]: zaznamPrehledu({ odkazyPosledni: ['https://x.cz/krouzky/1', 'https://x.cz/krouzky/2', 'https://x.cz/krouzky/8'] }),
  });
  assert.equal(potvrd(sPrehled, [U], '2026-10-23').zapatiDatum, '2026-10-19');
  const sIgnor = potvrd(sPrehled, [U], '2026-10-23', { ignorovane: ['https://x.cz/krouzky/8'] });
  assert.equal(sIgnor.zapatiDatum, '2026-10-23');
});

test('vyhodnotBeh nemutuje predchozi', () => {
  const predchozi = stav({
    [U]: zaznam({ chyba: { druh: '404', status: 404, od: '2026-10-19', pocet: 1 } }),
    [P]: zaznamPrehledu(),
    'https://stara.cz': zaznam(),
  });
  const kopie = structuredClone(predchozi);
  const { stav: s } = beh({
    predchozi, sez: seznam({ [U]: { druh: 'obsah', pouziti: POUZITI }, ...PREHLED }),
    mer: {
      [U]: mereni({ vysledek: chyba('404', 404), otisk: null }),
      [P]: mereni({ otisk: 'p2', odkazy: ['https://x.cz/krouzky/1', 'https://x.cz/krouzky/7'] }),
    },
  });
  assert.deepEqual(predchozi, kopie);
  s.url[P].odkazyPotvrzene.push('x');
  assert.deepEqual(predchozi, kopie, 'výstup nesdílí pole se vstupem');
});

test('8: trvalé přesměrování nové URL (první běh) se uloží jako výchozí stav a nehlásí se', () => {
  const cil = 'https://x.cz/prihlaseni';
  const vysledek = ok({ konecnaUrl: cil, trvalePresmerovano: true });
  const r1 = beh({ predchozi: prazdnyStav(), mer: { [U]: mereni({ vysledek }) } });
  assert.equal(r1.stav.url[U].presmerovani, cil);
  assert.deepEqual(r1.nalezy.presmerovani.nove, []);

  // Dostupnost: stejné chování u nově sledovaného přihlašovacího odkazu.
  const D = 'https://p.cz/detail/1';
  const pouzitiD = [{ id: 'a', pole: 'prihlaska.odkaz' }];
  const sez = seznam({ [D]: { druh: 'dostupnost', pouziti: pouzitiD } });
  const merD = (konecnaUrl) => ({ [D]: mereni({ otisk: null, vysledek: ok({ konecnaUrl, trvalePresmerovano: true }) }) });
  const r2 = beh({ predchozi: prazdnyStav(), sez, mer: merD(cil) });
  assert.equal(r2.stav.url[D].presmerovani, cil);
  assert.deepEqual(r2.nalezy.presmerovani.nove, []);

  // Další běh se stejným cílem: nic; změna cíle: hlásí se.
  const r3 = beh({ predchozi: r2.stav, sez, mer: merD(cil), dnes: '2026-10-25' });
  assert.deepEqual(r3.nalezy.presmerovani.nove, []);
  const jiny = 'https://p.cz/jinam';
  const r4 = beh({ predchozi: r3.stav, sez, mer: merD(jiny), dnes: '2026-10-28' });
  assert.deepEqual(r4.nalezy.presmerovani.nove, [{ url: D, pouziti: pouzitiD, cil: jiny }]);
});

test('6: přehled bez změřených odkazů (odkazy null, např. odpověď není HTML) = neměřeno, nic se nehlásí', () => {
  const pred = zaznamPrehledu({ etag: '"p1"', posledniOk: '2026-10-19' });
  const r = beh({
    predchozi: stav({ [P]: pred }),
    sez: seznam(PREHLED),
    mer: { [P]: mereni({ otisk: 'jiny', odkazy: null, vysledek: ok({ konecnaUrl: P, contentType: 'application/pdf', etag: '"p2"' }) }) },
  });
  const z = r.stav.url[P];
  assert.deepEqual(z.odkazyPotvrzene, pred.odkazyPotvrzene);
  assert.deepEqual(z.odkazyPosledni, pred.odkazyPosledni);
  assert.equal(z.posledniOk, '2026-10-19', 'posledniOk se neposouvá');
  assert.equal(z.etag, '"p1"', 'validátory se nemění, příště se stáhne znovu celé');
  assert.equal(z.posledniKontrola, '2026-10-22');
  assert.deepEqual(r.nalezy.prehledy, { nove: [], zrusene: [], pretrvavajici: 0 });
  assert.equal(r.nalezy.noveSledovano, 0);

  // Nově sledovaný přehled bez odkazů: zůstane bez výchozího stavu.
  const r2 = beh({ predchozi: prazdnyStav(), sez: seznam(PREHLED), mer: { [P]: mereni({ odkazy: null, vysledek: ok({ konecnaUrl: P }) }) } });
  assert.equal(r2.stav.url[P].odkazyPotvrzene, null);
  assert.equal(r2.stav.url[P].posledniOk, null);
  assert.equal(r2.nalezy.noveSledovano, 0);
  assert.deepEqual(r2.nalezy.prehledy, { nove: [], zrusene: [], pretrvavajici: 0 });
});

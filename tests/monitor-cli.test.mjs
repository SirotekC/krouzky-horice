import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { behKontroly, behPotvrzeni } from '../scripts/monitor.mjs';
import { sGitStavem } from '../scripts/monitor/git-stav.mjs';

const DNES = '2026-10-25';
const HTML = (text, odkazy = []) => `<html><body><p>${text}</p>${odkazy.map((u) => `<a href="${u}">x</a>`).join('')}</body></html>`;

/** Dočasný kořen projektu s malými daty. */
async function pripravKoren({ aktivity, organizace = [], nastaveni = {} }) {
  const koren = await mkdtemp(path.join(tmpdir(), 'monitor-cli-'));
  await mkdir(path.join(koren, 'site', 'data'), { recursive: true });
  await mkdir(path.join(koren, 'data-src'), { recursive: true });
  await writeFile(path.join(koren, 'site', 'data', 'aktivity.json'), JSON.stringify(aktivity));
  await writeFile(path.join(koren, 'site', 'data', 'organizace.json'), JSON.stringify(organizace));
  await writeFile(path.join(koren, 'data-src', 'monitor.json'), JSON.stringify({ pauzaMs: 0, ...nastaveni }));
  return koren;
}
const existuje = (soubor) => access(soubor).then(() => true, () => false);
const cekej = async () => {};

/** Falešný fetch nad tabulkou `url → { status, telo, headers }`; zapisuje volání. */
function falesnyFetch(tabulka, volani = []) {
  return async (url, init = {}) => {
    volani.push({ url, method: init.method, headers: init.headers });
    const z = tabulka[url];
    if (typeof z === 'function') return z(url, init);
    if (!z) return new Response('', { status: 404 });
    return new Response(z.telo ?? '', {
      status: z.status ?? 200,
      headers: { 'content-type': 'text/html; charset=utf-8', ...(z.headers ?? {}) },
    });
  };
}

const AKTIVITY = [
  { id: 'a-1', zdroj_url: 'https://a.cz/k1', prihlaska: { odkaz: 'https://a.cz/prihlaska' } },
  { id: 'b-1', zdroj_url: 'https://b.cz/k' },
  { id: 'c-1', zdroj_url: 'https://c.cz/k' },
];

test('první běh: zapíše stav, kontrola.json a issue „bez nových problémů“; robots 1× na doménu', async () => {
  const koren = await pripravKoren({
    aktivity: AKTIVITY,
    nastaveni: {
      prehledy: [{ url: 'https://a.cz/krouzky', organizace_id: 'a', vzorOdkazu: '^https://a\\.cz/krouzky/\\d+' }],
      domeny: { 'a.cz': { obsah: 'p' } },
    },
  });
  const volani = [];
  const fetchFn = falesnyFetch({
    'https://a.cz/robots.txt': { status: 200, telo: 'User-agent: *\nDisallow: /zakazano\n', headers: { 'content-type': 'text/plain' } },
    'https://a.cz/k1': { telo: HTML('kroužek A'), headers: { etag: '"a1"' } },
    'https://a.cz/prihlaska': { telo: '' },
    'https://a.cz/krouzky': { telo: HTML('přehled', ['/krouzky/1-x', '/krouzky/2-y', '/jinam']) },
    'https://b.cz/k': { telo: HTML('kroužek B') },
    'https://c.cz/robots.txt': { status: 503 },
  }, volani);
  const stavAdresar = path.join(koren, '.monitor-stav');
  const vystupAdresar = path.join(koren, '.monitor-vystup');
  try {
    await behKontroly({ koren, stavAdresar, vystupAdresar, fetchFn, cekej, dnes: DNES });

    const robots = volani.filter((v) => v.url.endsWith('/robots.txt')).map((v) => v.url).sort();
    assert.deepEqual(robots, ['https://a.cz/robots.txt', 'https://b.cz/robots.txt', 'https://c.cz/robots.txt']);
    assert.ok(!volani.some((v) => v.url === 'https://c.cz/k'), 'doména s nedostupným robots.txt se nestahuje');
    assert.ok(volani.every((v) => v.headers['User-Agent'].startsWith('KrouzkyHorice-monitor/1.0 ')));

    const stav = JSON.parse(await readFile(path.join(stavAdresar, 'stav.json'), 'utf8'));
    assert.equal(stav.posledniBeh, DNES);
    assert.deepEqual(Object.keys(stav.url), [...Object.keys(stav.url)].sort());
    assert.equal(stav.url['https://a.cz/k1'].etag, '"a1"');
    assert.match(stav.url['https://a.cz/k1'].otiskPotvrzeny, /^[0-9a-f]{64}$/);
    assert.deepEqual(stav.url['https://a.cz/krouzky'].odkazyPotvrzene, ['https://a.cz/krouzky/1-x', 'https://a.cz/krouzky/2-y']);
    assert.ok(!('https://c.cz/k' in stav.url), 'přeskočená URL bez předchozího stavu se neukládá');
    assert.ok(!(await existuje(path.join(stavAdresar, 'stav.json.tmp'))));

    const kontrola = JSON.parse(await readFile(path.join(koren, 'site', 'data', 'kontrola.json'), 'utf8'));
    assert.deepEqual(kontrola, { zdrojeZkontrolovany: DNES, url: { 'https://a.cz/k1': DNES, 'https://b.cz/k': DNES } });

    assert.equal(await readFile(path.join(vystupAdresar, 'issue-nazev.txt'), 'utf8'), `Kontrola zdrojů ${DNES}: bez nových problémů`);
    assert.equal(await readFile(path.join(vystupAdresar, 'zavrit'), 'utf8'), 'true');
    const issue = await readFile(path.join(vystupAdresar, 'issue.md'), 'utf8');
    assert.match(issue, /Zkontrolováno 4 URL/);
    assert.match(issue, /Nově sledováno: 4/);
    assert.match(issue, /https:\/\/c\.cz\/k – robots-nedostupny/);
    assert.ok(!issue.includes('kroužek'), 'text stránek se do issue nedostane');

    // Druhý běh: změna textu u b.cz → nová změna, a.cz/k1 vrátí 304 na If-None-Match.
    volani.length = 0;
    const fetchFn2 = falesnyFetch({
      'https://a.cz/robots.txt': { status: 404 },
      'https://a.cz/k1': (url, init) => (init.headers['If-None-Match'] === '"a1"'
        ? new Response(null, { status: 304 }) : new Response(HTML('jiný'), { status: 200 })),
      'https://a.cz/prihlaska': { telo: '' },
      'https://a.cz/krouzky': { telo: HTML('přehled', ['/krouzky/1-x', '/krouzky/2-y']) },
      'https://b.cz/k': { telo: HTML('kroužek B – nový rozvrh') },
      'https://c.cz/robots.txt': { status: 503 },
    }, volani);
    await behKontroly({ koren, stavAdresar, vystupAdresar, fetchFn: fetchFn2, cekej, dnes: '2026-10-28' });
    assert.equal(await readFile(path.join(vystupAdresar, 'issue-nazev.txt'), 'utf8'), 'Kontrola zdrojů 2026-10-28: 1 nová změna');
    assert.equal(await readFile(path.join(vystupAdresar, 'zavrit'), 'utf8'), 'false');
    const issue2 = await readFile(path.join(vystupAdresar, 'issue.md'), 'utf8');
    assert.match(issue2, /z toho 1 beze změny přes 304/);
    assert.match(issue2, /- https:\/\/b\.cz\/k – b-1 \(zdroj_url\)/);
    const kontrola2 = JSON.parse(await readFile(path.join(koren, 'site', 'data', 'kontrola.json'), 'utf8'));
    assert.deepEqual(kontrola2, { zdrojeZkontrolovany: DNES, url: { 'https://a.cz/k1': '2026-10-28', 'https://b.cz/k': DNES } });
  } finally {
    await rm(koren, { recursive: true, force: true });
  }
});

test('pauza: robots.txt je první požadavek na doménu, před dalším se čeká max(pauzaMs, crawlDelay)', async () => {
  const koren = await pripravKoren({
    aktivity: [{ id: 'a-1', zdroj_url: 'https://a.cz/k1' }, { id: 'a-2', zdroj_url: 'https://a.cz/k2' }, { id: 'a-3', zdroj_url: 'https://a.cz/zakazano' }],
    nastaveni: { pauzaMs: 1000 },
  });
  const udalosti = [];
  const fetchFn = falesnyFetch({
    'https://a.cz/robots.txt': { status: 200, telo: 'User-agent: *\nCrawl-delay: 3\nDisallow: /zakazano\n' },
    'https://a.cz/k1': { telo: HTML('1') },
    'https://a.cz/k2': { telo: HTML('2') },
  }, { push: (v) => udalosti.push(v.url) });
  try {
    await behKontroly({
      koren, stavAdresar: path.join(koren, 's'), vystupAdresar: path.join(koren, 'v'), fetchFn,
      cekej: async (ms) => { udalosti.push(`čekej ${ms}`); }, dnes: DNES,
    });
    assert.deepEqual(udalosti, ['https://a.cz/robots.txt', 'čekej 3000', 'https://a.cz/k1', 'čekej 3000', 'https://a.cz/k2']);
    const issue = await readFile(path.join(koren, 'v', 'issue.md'), 'utf8');
    assert.match(issue, /https:\/\/a\.cz\/zakazano – robots\b/);
  } finally {
    await rm(koren, { recursive: true, force: true });
  }
});

test('při výjimce během měření se stav.json nezapíše', async () => {
  // b.cz má v pravidlech neplatný regulární výraz: htmlNaText vyhodí až po změření a.cz.
  const koren = await pripravKoren({
    aktivity: [{ id: 'a-1', zdroj_url: 'https://a.cz/k' }, { id: 'b-1', zdroj_url: 'https://b.cz/k' }],
    nastaveni: { domeny: { 'b.cz': { odstranitRadky: ['(neuzavreno'] } } },
  });
  const stavAdresar = path.join(koren, '.monitor-stav');
  const vystupAdresar = path.join(koren, '.monitor-vystup');
  await mkdir(stavAdresar);
  const puvodni = JSON.stringify({ verze: 1, posledniBeh: '2026-10-19', zapatiDatum: '2026-10-19', url: {} }, null, 2);
  await writeFile(path.join(stavAdresar, 'stav.json'), puvodni);
  let zmerenoA = false;
  const fetchFn = falesnyFetch({
    'https://a.cz/k': () => { zmerenoA = true; return new Response(HTML('A'), { headers: { 'content-type': 'text/html' } }); },
    'https://b.cz/k': async () => {
      // b.cz počká, až je a.cz změřené, aby pád nastal opravdu uprostřed běhu.
      while (!zmerenoA) await new Promise((r) => setImmediate(r));
      return new Response(HTML('B'), { headers: { 'content-type': 'text/html' } });
    },
  });
  try {
    await assert.rejects(behKontroly({ koren, stavAdresar, vystupAdresar, fetchFn, cekej, dnes: DNES }));
    assert.ok(zmerenoA);
    assert.equal(await readFile(path.join(stavAdresar, 'stav.json'), 'utf8'), puvodni, 'stav.json zůstal beze změny');
    assert.ok(!(await existuje(path.join(stavAdresar, 'stav.json.tmp'))));
    assert.ok(!(await existuje(path.join(koren, 'site', 'data', 'kontrola.json'))));
    assert.ok(!(await existuje(path.join(vystupAdresar, 'issue.md'))));
  } finally {
    await rm(koren, { recursive: true, force: true });
  }
});

test('při výjimce během měření prvního běhu stav.json nevznikne', async () => {
  const koren = await pripravKoren({
    aktivity: [{ id: 'a-1', zdroj_url: 'https://a.cz/k' }],
    nastaveni: { domeny: { 'a.cz': { odstranitRadky: ['['] } } },
  });
  const stavAdresar = path.join(koren, '.monitor-stav');
  try {
    await assert.rejects(behKontroly({
      koren, stavAdresar, vystupAdresar: path.join(koren, 'v'), fetchFn: falesnyFetch({ 'https://a.cz/k': { telo: HTML('A') } }), cekej, dnes: DNES,
    }));
    assert.ok(!(await existuje(path.join(stavAdresar, 'stav.json'))));
  } finally {
    await rm(koren, { recursive: true, force: true });
  }
});

/** Falešný `spust` pro git: zapisuje volání, push odmítne `odmitnoutPush`krát. */
function falesnyGit({ odmitnoutPush = 0, priWorktreeAdd } = {}) {
  const volani = [];
  let odmitnuto = 0;
  const spust = async (prikaz, args, moznosti = {}) => {
    volani.push({ prikaz, args, cwd: moznosti.cwd });
    if (args[0] === 'worktree' && args[1] === 'add' && priWorktreeAdd) await priWorktreeAdd(args[3]);
    if (args[0] === 'status') return { stdout: ' M stav.json\n', stderr: '' };
    if (args[0] === 'push' && odmitnuto < odmitnoutPush) {
      odmitnuto++;
      throw Object.assign(new Error('rejected'), { stderr: '! [rejected] HEAD -> monitor-stav (fetch first)' });
    }
    return { stdout: '', stderr: '' };
  };
  return { spust, volani };
}

test('git-stav: při odmítnutém pushi pull --rebase a opakování, po 3 neúspěších výjimka', async () => {
  // Dvakrát odmítnuto, potřetí projde.
  const g1 = falesnyGit({ odmitnoutPush: 2 });
  let adresarFn;
  await sGitStavem(async (adresar) => { adresarFn = adresar; return 'Potvrzení: 1 URL'; }, { spust: g1.spust, koren: '/repo' });
  const prikazy = g1.volani.map((v) => v.args.join(' '));
  assert.equal(prikazy[0], 'fetch origin monitor-stav');
  assert.equal(prikazy[1], `worktree add --detach ${adresarFn} origin/monitor-stav`);
  assert.ok(prikazy.includes('commit -m Potvrzení: 1 URL'));
  assert.deepEqual(prikazy.filter((p) => p.startsWith('push') || p.startsWith('pull')), [
    'push origin HEAD:monitor-stav',
    'pull --rebase origin monitor-stav',
    'push origin HEAD:monitor-stav',
    'pull --rebase origin monitor-stav',
    'push origin HEAD:monitor-stav',
  ]);
  assert.equal(prikazy.at(-1), `worktree remove --force ${adresarFn}`);
  assert.ok(g1.volani.filter((v) => ['commit', 'push', 'pull', 'add'].includes(v.args[0])).every((v) => v.cwd === adresarFn));
  assert.ok(!(await existuje(adresarFn)), 'dočasný adresář je smazaný');

  // Třikrát odmítnuto → výjimka, worktree se přesto odstraní.
  const g2 = falesnyGit({ odmitnoutPush: 3 });
  await assert.rejects(
    sGitStavem(async () => 'Potvrzení: 1 URL', { spust: g2.spust, koren: '/repo' }),
    /push/,
  );
  const prikazy2 = g2.volani.map((v) => v.args.join(' '));
  assert.equal(prikazy2.filter((p) => p.startsWith('push')).length, 3);
  assert.equal(prikazy2.filter((p) => p.startsWith('pull')).length, 2);
  assert.match(prikazy2.at(-1), /^worktree remove --force /);
});

test('git-stav: výjimka ve fn = nic se necommituje ani nepushuje, worktree se odstraní', async () => {
  const g = falesnyGit();
  await assert.rejects(sGitStavem(async () => { throw new Error('chyba'); }, { spust: g.spust, koren: '/repo' }), /chyba/);
  const prikazy = g.volani.map((v) => v.args[0]);
  assert.ok(!prikazy.includes('commit') && !prikazy.includes('push'));
  assert.match(g.volani.at(-1).args.join(' '), /^worktree remove --force /);
});

test('potvrzení: potvrdí URL ve stavu z monitor-stav, zapíše kontrola.json a commitne „Potvrzení: N URL“', async () => {
  const koren = await pripravKoren({ aktivity: [{ id: 'a-1', zdroj_url: 'https://a.cz/k' }, { id: 'b-1', zdroj_url: 'https://b.cz/k' }] });
  const zaznam = (prepis) => ({
    druh: 'obsah', otiskPotvrzeny: 'aaa', otiskPosledni: 'aaa', verzePravidel: 'v', etag: null, lastModified: null,
    posledniKontrola: '2026-10-25', posledniOk: '2026-10-25', zmena: null, chyba: null, presmerovani: null, ...prepis,
  });
  const stav = {
    verze: 1, posledniBeh: '2026-10-25', zapatiDatum: '2026-10-19',
    url: {
      'https://a.cz/k': zaznam({ otiskPosledni: 'bbb', posledniOk: '2026-10-19', zmena: { od: '2026-10-25', otisk: 'bbb' } }),
      'https://b.cz/k': zaznam({}),
    },
  };
  let stavZapsany;
  const g = falesnyGit({
    priWorktreeAdd: async (adresar) => writeFile(path.join(adresar, 'stav.json'), JSON.stringify(stav)),
  });
  const puvodniSpust = g.spust;
  const spust = async (prikaz, args, moznosti) => {
    if (args[0] === 'commit') stavZapsany = JSON.parse(await readFile(path.join(moznosti.cwd, 'stav.json'), 'utf8'));
    return puvodniSpust(prikaz, args, moznosti);
  };
  try {
    const n = await behPotvrzeni({ koren, urls: ['https://a.cz/k#fragment'], dnes: '2026-10-26', spust });
    assert.equal(n, 1);
    assert.ok(g.volani.some((v) => v.args.join(' ') === 'commit -m Potvrzení: 1 URL'));
    assert.equal(stavZapsany.url['https://a.cz/k'].otiskPotvrzeny, 'bbb');
    assert.equal(stavZapsany.url['https://a.cz/k'].zmena, null);
    assert.equal(stavZapsany.zapatiDatum, '2026-10-26');
    const kontrola = JSON.parse(await readFile(path.join(koren, 'site', 'data', 'kontrola.json'), 'utf8'));
    assert.deepEqual(kontrola, { zdrojeZkontrolovany: '2026-10-26', url: { 'https://a.cz/k': '2026-10-26', 'https://b.cz/k': '2026-10-25' } });
  } finally {
    await rm(koren, { recursive: true, force: true });
  }
});

test('potvrzení: URL, která není ve stavu, je chyba (nic se necommituje)', async () => {
  const koren = await pripravKoren({ aktivity: [{ id: 'a-1', zdroj_url: 'https://a.cz/k' }] });
  const g = falesnyGit({
    priWorktreeAdd: async (adresar) => writeFile(path.join(adresar, 'stav.json'), JSON.stringify({ verze: 1, posledniBeh: null, zapatiDatum: null, url: {} })),
  });
  try {
    await assert.rejects(behPotvrzeni({ koren, urls: ['https://neni.cz/'], dnes: DNES, spust: g.spust }), /neni\.cz/);
    assert.ok(!g.volani.some((v) => v.args[0] === 'commit'));
  } finally {
    await rm(koren, { recursive: true, force: true });
  }
});

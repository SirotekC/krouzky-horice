// Monitoring zdrojů: stáhne sledované URL, porovná otisky s uloženým stavem a připraví issue.
// Použití:
//   node scripts/monitor.mjs --stav <adresář> --vystup <adresář>   kontrola (exit 1 jen při pádu)
//   node scripts/monitor.mjs --potvrdit <url…>                      potvrzení vyřešených URL
//   node scripts/monitor.mjs --potvrdit-vse                         potvrzení všech URL

import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { dnesPraha } from '../site/js/registration.js';
import { normalizujUrl, sestavSeznamUrl, nactiNastaveni } from './monitor/seznam-url.mjs';
import { dekoduj, htmlNaText, odkazyPrehledu, otisk, verzePravidel, jeHtml } from './monitor/cisteni.mjs';
import { robotsZOdpovedi } from './monitor/robots.mjs';
import { stahni, zpracujPoDomenach } from './monitor/stahovani.mjs';
import { prazdnyStav, vyhodnotBeh, potvrd } from './monitor/stav.mjs';
import { sestavIssue } from './monitor/souhrn.mjs';
import { sestavKontrolu } from './monitor/kontrola-webu.mjs';
import { sGitStavem } from './monitor/git-stav.mjs';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'KrouzkyHorice-monitor/1.0 (+https://sirotekc.github.io/krouzky-horice/o-projektu.html)';
const VYCHOZI_PAUZA_MS = 5000;

async function nactiJson(soubor) {
  const text = await readFile(soubor, 'utf8');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${soubor}: neplatný JSON – ${e.message}`);
  }
}

/** Zapíše JSON (odsazení 2 mezery) atomicky: nejdřív do `.tmp`, pak přejmenování. */
async function zapisJsonAtomicky(soubor, data) {
  await mkdir(path.dirname(soubor), { recursive: true });
  const docasny = `${soubor}.tmp`;
  try {
    await writeFile(docasny, `${JSON.stringify(data, null, 2)}\n`);
    await rename(docasny, soubor);
  } catch (e) {
    await rm(docasny, { force: true });
    throw e;
  }
}

/** Načte data projektu a nastavení monitoringu; vrátí i odvozený seznam URL. */
async function nactiVstupy(koren) {
  const [aktivity, organizace, nastaveni] = await Promise.all([
    nactiJson(path.join(koren, 'site', 'data', 'aktivity.json')),
    nactiJson(path.join(koren, 'site', 'data', 'organizace.json')),
    nactiNastaveni(path.join(koren, 'data-src', 'monitor.json')),
  ]);
  const seznam = sestavSeznamUrl({ aktivity, organizace, nastaveni });
  const znameZdroje = new Set(aktivity.filter((a) => a.zdroj_url).map((a) => normalizujUrl(a.zdroj_url)));
  return { nastaveni, seznam, znameZdroje, ignorovane: nastaveni.ignorovaneOdkazy ?? [] };
}

/** Stáhne robots.txt domény (počítá se jako požadavek na doménu). */
async function nactiRobots(origin, { fetchFn }) {
  const v = await stahni(`${origin}/robots.txt`, {}, { fetchFn, ua: UA });
  const text = v.telo ? v.telo.toString('utf8') : null;
  return robotsZOdpovedi(v.status, text, UA);
}

/**
 * Změří jednu URL: stáhne ji a spočítá otisk (HTML čištěné podle pravidel domény, jinak syrová data)
 * a u přehledu se vzorem i množinu odkazů. Výjimka (např. neplatné pravidlo) = pád celého běhu.
 */
async function zmer(url, polozka, predchozi, { fetchFn, nastaveni }) {
  const pravidla = nastaveni.domeny?.[new URL(url).hostname];
  const vysledek = await stahni(url, {
    druh: polozka.druh, etag: predchozi?.etag ?? null, lastModified: predchozi?.lastModified ?? null,
  }, { fetchFn, ua: UA });
  let otiskObsahu = null;
  let odkazy = null;
  if (polozka.druh !== 'dostupnost' && !vysledek.chyba && !vysledek.beZmeny && vysledek.telo) {
    if (jeHtml(vysledek.contentType)) {
      const html = dekoduj(vysledek.telo, vysledek.contentType);
      otiskObsahu = otisk(htmlNaText(html, pravidla));
      if (polozka.vzorOdkazu) odkazy = odkazyPrehledu(html, vysledek.konecnaUrl, polozka.vzorOdkazu);
    } else {
      otiskObsahu = otisk(vysledek.telo);
      if (polozka.vzorOdkazu) odkazy = [];
    }
  }
  vysledek.telo = null; // tělo se dál nepotřebuje a nikam se neukládá
  return { vysledek, otisk: otiskObsahu, odkazy, verzePravidel: verzePravidel(pravidla), preskoceno: null };
}

/**
 * Kontrola všech sledovaných URL. Stav, kontrola.json a výstupy pro issue se zapisují až po
 * úspěšném změření a vyhodnocení všeho; při výjimce se nezapíše nic.
 * @param {{ koren?: string, stavAdresar: string, vystupAdresar: string, fetchFn?: typeof fetch,
 *   cekej?: (ms: number) => Promise<void>, dnes?: string, log?: (zprava: string) => void }} moznosti
 * @returns {Promise<{ nazev: string, telo: string, zavrit: boolean, nalezy: object }>}
 */
export async function behKontroly({ koren = KOREN, stavAdresar, vystupAdresar, fetchFn = fetch, cekej, dnes = dnesPraha(), log = () => {} }) {
  const { nastaveni, seznam, znameZdroje, ignorovane } = await nactiVstupy(koren);
  const souborStavu = path.join(stavAdresar, 'stav.json');
  let predchozi;
  try {
    predchozi = await nactiJson(souborStavu);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    predchozi = prazdnyStav();
  }

  // 1. robots.txt jednou na doménu (domény souběžně).
  const domeny = new Map(); // hostname → origin
  for (const url of seznam.keys()) {
    const u = new URL(url);
    if (!domeny.has(u.hostname)) domeny.set(u.hostname, u.origin);
  }
  const robots = new Map(await Promise.all([...domeny].map(async ([host, origin]) => [host, await nactiRobots(origin, { fetchFn })])));
  log(`robots.txt: ${domeny.size} domén`);

  // 2. Rozdělení na přeskočené a ke stažení.
  const mereni = new Map();
  const keStazeni = [];
  for (const [url, polozka] of seznam) {
    const u = new URL(url);
    const r = robots.get(u.hostname);
    if (r.stav === 'nedostupny') mereni.set(url, { vysledek: null, otisk: null, odkazy: null, verzePravidel: null, preskoceno: 'robots-nedostupny' });
    else if (!r.pravidla.povoleno(`${u.pathname}${u.search}`)) mereni.set(url, { vysledek: null, otisk: null, odkazy: null, verzePravidel: null, preskoceno: 'robots' });
    else keStazeni.push({ url, polozka });
  }

  // 3. Stahování po doménách s pauzou; robots.txt byl první požadavek, takže se čeká i před prvním.
  const pauzaProDomenu = (host) => Math.max(nastaveni.pauzaMs ?? VYCHOZI_PAUZA_MS, (robots.get(host)?.pravidla?.crawlDelay ?? 0) * 1000);
  const cekat = cekej ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const zahajene = new Set();
  let hotovo = 0;
  await zpracujPoDomenach(keStazeni, async ({ url, polozka }) => {
    const host = new URL(url).hostname;
    if (!zahajene.has(host)) {
      zahajene.add(host);
      await cekat(pauzaProDomenu(host));
    }
    mereni.set(url, await zmer(url, polozka, predchozi.url[url], { fetchFn, nastaveni }));
    hotovo++;
    if (hotovo % 20 === 0) log(`staženo ${hotovo}/${keStazeni.length}`);
  }, { pauzaProDomenu, cekej: cekat });

  // 4. Vyhodnocení a teprve potom zápis (stav jako poslední, atomicky).
  const { stav, nalezy } = vyhodnotBeh({ predchozi, seznam, mereni, ignorovane, znameZdroje, dnes });
  const issue = sestavIssue(nalezy, dnes);
  await mkdir(vystupAdresar, { recursive: true });
  await writeFile(path.join(vystupAdresar, 'issue-nazev.txt'), issue.nazev);
  await writeFile(path.join(vystupAdresar, 'issue.md'), issue.telo);
  await writeFile(path.join(vystupAdresar, 'zavrit'), String(issue.zavrit));
  await zapisJsonAtomicky(path.join(koren, 'site', 'data', 'kontrola.json'), sestavKontrolu(stav, seznam));
  await zapisJsonAtomicky(souborStavu, stav);
  return { ...issue, nalezy };
}

/**
 * Potvrzení vyřešených URL ve větvi monitor-stav (bez stahování). Zapíše i `site/data/kontrola.json`
 * v pracovním stromu (commitne ho agent spolu s daty).
 * @param {{ koren?: string, urls: string[] | 'vse', dnes?: string, spust?: Function }} moznosti
 * @returns {Promise<number>} počet potvrzených URL
 */
export async function behPotvrzeni({ koren = KOREN, urls, dnes = dnesPraha(), spust }) {
  const { seznam, znameZdroje, ignorovane } = await nactiVstupy(koren);
  let pocet = 0;
  await sGitStavem(async (adresar) => {
    const souborStavu = path.join(adresar, 'stav.json');
    const stav = await nactiJson(souborStavu);
    let cile = 'vse';
    if (urls !== 'vse') {
      cile = [...new Set(urls.map((u) => normalizujUrl(u)))];
      const nezname = cile.filter((u) => !(u in stav.url));
      if (nezname.length) throw new Error(`URL nejsou ve stavu monitoringu: ${nezname.join(', ')}`);
    }
    pocet = cile === 'vse' ? Object.keys(stav.url).length : cile.length;
    const novy = potvrd(stav, cile, dnes, { ignorovane, znameZdroje });
    await zapisJsonAtomicky(souborStavu, novy);
    await zapisJsonAtomicky(path.join(koren, 'site', 'data', 'kontrola.json'), sestavKontrolu(novy, seznam));
    return `Potvrzení: ${pocet} URL`;
  }, { koren, ...(spust ? { spust } : {}) });
  return pocet;
}

/** Zpracuje argumenty příkazové řádky. */
function parsujArgumenty(argv) {
  const volby = { stav: '.monitor-stav', vystup: '.monitor-vystup', potvrdit: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--stav') volby.stav = argv[++i];
    else if (a === '--vystup') volby.vystup = argv[++i];
    else if (a === '--potvrdit-vse') volby.potvrdit = 'vse';
    else if (a === '--potvrdit') {
      volby.potvrdit = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) volby.potvrdit.push(argv[++i]);
      if (!volby.potvrdit.length) throw new Error('--potvrdit potřebuje aspoň jednu URL');
    } else throw new Error(`neznámý argument „${a}“`);
  }
  if (!volby.stav || !volby.vystup) throw new Error('--stav a --vystup potřebují adresář');
  return volby;
}

async function main() {
  try {
    const volby = parsujArgumenty(process.argv.slice(2));
    if (volby.potvrdit) {
      const n = await behPotvrzeni({ urls: volby.potvrdit });
      console.log(`✔ Potvrzeno ${n} URL ve větvi monitor-stav, zapsán site/data/kontrola.json.`);
      return;
    }
    const { nazev, nalezy } = await behKontroly({
      stavAdresar: path.resolve(volby.stav),
      vystupAdresar: path.resolve(volby.vystup),
      log: (z) => console.log(z),
    });
    console.log(`✔ ${nazev}`);
    console.log(`Zkontrolováno ${nalezy.zkontrolovano} URL, přes 304 ${nalezy.beZmeny304}, přeskočeno ${nalezy.preskoceno.length}.`);
  } catch (e) {
    console.error(`✖ ${e.stack ?? e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

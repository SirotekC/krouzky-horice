# Monitoring zdrojů – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Každé 3 dny automaticky zkontrolovat zdroje a odkazy z dat, poslat souhrn jako GitHub issue (e-mail) a na webu zobrazovat datum „Data načtena“.

**Architecture:** Skript `scripts/monitor.mjs` se skládá z čistých modulů v `scripts/monitor/`: seznam URL, čištění HTML, robots.txt, vyhodnocení stavu, text issue, `kontrola.json`. Síťová a gitová část jsou oddělené, aby šlo všechno ostatní testovat bez sítě. Stav mezi běhy je ve větvi `monitor-stav` (`stav.json`). Do `main` jde jen `site/data/kontrola.json`. Workflow v GitHub Actions spouští skript, ukládá stav, zakládá issue a spouští nasazení.

**Tech Stack:** Node.js (ES moduly, vestavěný `fetch`, `crypto`, `node:test`), `node-html-parser`, GitHub Actions, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-10-22-monitoring-zdroju-design.md`

## Global Constraints

- Kód, identifikátory, komentáře a texty česky, styl jako `scripts/validate.mjs` (JSDoc nad exporty, `node:` importy).
- Lokálně Node 18 (vestavěný `fetch`, `TextDecoder` s plným ICU), CI `lts/*`.
- Jediná nová závislost: `node-html-parser` (runtime pro skript, ne pro web – do `dependencies` není třeba, stačí `devDependencies` jako `ajv`).
- **Do repozitáře ani do issue nesmí jít text stránek.** Ukládají se jen otisky (SHA-256 hex), URL, id, stavové kódy, data.
- User-Agent: `KrouzkyHorice-monitor/1.0 (+https://sirotekc.github.io/krouzky-horice/o-projektu.html)`.
- Pauza mezi požadavky na stejnou doménu: `max(nastaveni.pauzaMs ?? 5000, crawlDelay * 1000)`. Domény mohou běžet souběžně.
- Timeout 20 s, max. 5 přesměrování, max. velikost těla 10 MB (větší = chyba `prilis-velke`).
- Nefunkční odkaz se hlásí až po **2 neúspěších po sobě**. `403`/`429` = druh `odmitnuto`, hlásí se zvlášť.
- Monitoring v `main` mění **jen** `site/data/kontrola.json`.
- Cron `17 2 */3 * *`.
- Data ve formátu `YYYY-MM-DD`, „dnes“ přes `dnesPraha()` ze `site/js/registration.js`.

## Review Focus

1. **Stránka v kódování windows-1250** (starší české weby): text se musí dekódovat podle `charset` z hlavičky nebo `<meta>`, jinak by otisk závisel na chybném dekódování. → test v úkolu 2.
2. **Zrušený kroužek DDM přesměruje na přehled místo 404**: trvalé přesměrování na jinou URL se musí objevit v issue jako informace. Nesmí se tiše brát jako „beze změny“. → test v úkolu 4.
3. **`robots.txt` vrací 404, nebo je nedostupný (5xx/timeout)**: 404 = vše povoleno. 5xx/timeout = doména se v tomto běhu přeskočí a uvede jako přeskočená, nesmí se brát jako chyba odkazů. → test v úkolu 3.
4. **URL lišící se jen `#fragmentem` nebo koncovým lomítkem v datech**: musí se deduplikovat, jinak by se stahovaly dvakrát. → test v úkolu 1.
5. **Pád skriptu uprostřed běhu**: stav se nesmí uložit napůl. Zapisuje se až na konci, atomicky (zápis do dočasného souboru a přejmenování), a workflow musí selhat. → test v úkolu 6 (zápis až po úspěšném vyhodnocení).

---

## Struktura souborů

| Soubor | Odpovědnost |
|---|---|
| `data-src/monitor.json` | Nastavení: pauza, doplňkové URL, přehledy, pravidla domén, ignorované odkazy |
| `scripts/monitor/seznam-url.mjs` | Sestavení seznamu URL z dat + nastavení, normalizace URL |
| `scripts/monitor/cisteni.mjs` | Dekódování, HTML → text, pravidla šumu, odkazy z přehledu, otisk, verze pravidel |
| `scripts/monitor/robots.mjs` | Parsování `robots.txt`, `Crawl-delay` |
| `scripts/monitor/stahovani.mjs` | `fetch` s podmíněnými hlavičkami, `HEAD` → `GET`, klasifikace chyb, plánovač po doménách |
| `scripts/monitor/stav.mjs` | Vyhodnocení běhu proti předchozímu stavu (nové/přetrvávající/vyřešené, výchozí stav, potvrzení) |
| `scripts/monitor/souhrn.mjs` | Název a tělo issue, příznak „zavřít“ |
| `scripts/monitor/kontrola-webu.mjs` | Sestavení `site/data/kontrola.json` ze stavu |
| `scripts/monitor/git-stav.mjs` | Lokální práce s větví `monitor-stav` pro `--potvrdit` (worktree, commit, push s opakováním) |
| `scripts/monitor.mjs` | CLI: běh kontroly a `--potvrdit` |
| `schema/kontrola.schema.json` | Schéma `kontrola.json` |
| `site/data/kontrola.json` | Data kontrol pro web |
| `site/js/data.js`, `site/js/render.js`, `site/js/app.js` | „Data načtena“ na kartě a v zápatí |
| `.github/workflows/monitor.yml` | Plánovaný běh |
| `tests/monitor-*.test.mjs` | Testy modulů |

### Formáty (sdílené všemi úkoly)

`data-src/monitor.json`:
```json
{
  "pauzaMs": 5000,
  "doplnkoveUrl": [{ "url": "https://…/letak.jpg", "organizace_id": "rc-konvicka", "popis": "leták s rozvrhem" }],
  "prehledy": [
    { "url": "https://www.ddmhorice.cz/krouzky", "organizace_id": "ddm-horice", "vzorOdkazu": "^https://www\\.ddmhorice\\.cz/krouzky/\\d+-" },
    { "url": "https://www.florbalhorice.cz/treninky", "organizace_id": "florbal-horice" }
  ],
  "domeny": {
    "www.ddmhorice.cz": { "obsah": "#krouzky_detail", "odstranitRadky": ["^Volná místa\\b"] }
  },
  "ignorovaneOdkazy": ["https://www.ddmhorice.cz/krouzky/…-fit-dance"]
}
```
Přehled s `vzorOdkazu` = sleduje se množina odkazů. Bez něj = sleduje se otisk textu jako běžný zdroj.

`stav.json` ve větvi `monitor-stav` (klíče `url` seřazené abecedně, odsazení 2 mezery, kvůli čitelnému diffu a slučování):
```json
{
  "verze": 1,
  "posledniBeh": "2026-10-25",
  "zapatiDatum": "2026-10-25",
  "url": {
    "https://…": {
      "druh": "obsah | dostupnost | prehled",
      "otiskPotvrzeny": "hex | null", "otiskPosledni": "hex | null",
      "odkazyPotvrzene": ["…"], "odkazyPosledni": ["…"],
      "verzePravidel": "hex",
      "etag": "… | null", "lastModified": "… | null",
      "posledniKontrola": "YYYY-MM-DD", "posledniOk": "YYYY-MM-DD | null",
      "zmena": { "od": "YYYY-MM-DD", "otisk": "hex" } ,
      "chyba": { "druh": "404 | 410 | 5xx | dns | timeout | certifikat | prilis-velke | odmitnuto", "status": 404, "od": "YYYY-MM-DD", "pocet": 2 },
      "presmerovani": "https://… | null"
    }
  }
}
```
`zmena` a `chyba` jsou `null`, když nic není. `odkazy*` jen u `druh: prehled`.

`site/data/kontrola.json`:
```json
{ "zdrojeZkontrolovany": "2026-10-25", "url": { "https://…": "2026-10-25" } }
```

---

### Úkol 1: Nastavení a seznam URL

**Files:**
- Create: `data-src/monitor.json`, `scripts/monitor/seznam-url.mjs`
- Test: `tests/monitor-seznam-url.test.mjs`

**Interfaces:**
- Produces:
  - `normalizujUrl(url: string): string` – odstraní `#fragment`, převede hostname na malá písmena, odstraní koncové `/` jen u cesty `/` (tj. `https://a.cz/` → `https://a.cz`). Jinak cestu nemění.
  - `sestavSeznamUrl({ aktivity, organizace, nastaveni }): Map<string, { druh: 'obsah'|'dostupnost'|'prehled', pouziti: {id: string, pole: string}[], vzorOdkazu?: string }>` – priorita druhu: `prehled` > `obsah` > `dostupnost`.
  - `nactiNastaveni(cesta?: string): Promise<object>` – načte `data-src/monitor.json`.

- [ ] **Step 1: Testy**

```js
test('zdroj_url je obsah, prihlaska.odkaz a web jen dostupnost', ...)
  // aktivita {id:'a', zdroj_url:'https://x.cz/k', prihlaska:{odkaz:'https://p.cz/1'}}, organizace {id:'o', web:'https://x.cz', zdroj_url:'https://x.cz/kontakt'}
  // → get('https://x.cz/k').druh === 'obsah'; get('https://p.cz/1').druh === 'dostupnost'; get('https://x.cz').druh === 'dostupnost'; get('https://x.cz/kontakt').druh === 'obsah'
test('stejná URL v obsahu i dostupnosti je jednou jako obsah a má obě použití', ...)
  // pouziti deepEqual [{id:'a',pole:'zdroj_url'},{id:'b',pole:'prihlaska.odkaz'}]
test('URL lišící se #fragmentem nebo koncovým lomítkem kořene se sloučí', ...)
  // 'https://X.cz/#top' a 'https://x.cz' → size 1
test('přehled s vzorOdkazu má druh prehled a nese vzor', ...)
test('doplňkové URL jsou obsah s použitím organizace_id a pole "monitor.json"', ...)
```

- [ ] **Step 2: Spustit, ověřit selhání** – `node --test tests/monitor-seznam-url.test.mjs` → FAIL (modul neexistuje).
- [ ] **Step 3: Implementace** v `scripts/monitor/seznam-url.mjs`. `data-src/monitor.json` naplnit:
  - `pauzaMs: 5000`
  - přehledy: všechny „stránky s kroužky“ ze `data-src/zdroje.md`. Jen DDM má `vzorOdkazu`, ostatní bez něj.
  - `doplnkoveUrl`: přímé URL obrázků a PDF s rozvrhy pro rc-konvicka, kct-horice-turistacek, zus-melodie, kluho. Dohledat na stránkách uvedených v `zdroje.md`, každou stránku stáhnout nejvýš jednou.
  - `domeny`: pravidlo pro DDM podle formátu výše.
  - `ignorovaneOdkazy`: 17 kroužků jen pro dospělé. Jejich URL zjistit z přehledu `https://www.ddmhorice.cz/krouzky` tak, že od 80 odkazů odečteš `zdroj_url` z dat.
- [ ] **Step 4: Testy projdou** – `node --test tests/monitor-seznam-url.test.mjs` → PASS.
- [ ] **Step 5: Commit** – `git commit -m "Monitoring: nastavení a seznam sledovaných URL"`

### Úkol 2: Čištění obsahu a otisky

**Files:**
- Create: `scripts/monitor/cisteni.mjs`
- Modify: `package.json` (devDependency `node-html-parser`)
- Test: `tests/monitor-cisteni.test.mjs`

**Interfaces:**
- Produces:
  - `dekoduj(telo: Buffer, contentType: string|null): string` – charset z hlavičky, jinak z `<meta charset>` / `<meta http-equiv>` v prvních 2 kB, jinak UTF-8.
  - `htmlNaText(html: string, pravidla?: { obsah?: string, odstranitRadky?: string[] }): string` – odstraní `script, style, noscript, nav, header, footer, form`; když je `obsah`, vezme jen první shodu selektoru (když ji nenajde, celý `body`). Blokové prvky (`p, div, tr, li, h1–h6, br, table, section, article`) = nový řádek. Buňky v řádku se spojí mezerou. Bílé znaky se zkomprimují, prázdné řádky vypustí, pak se odstraní řádky odpovídající `odstranitRadky` (RegExp s flagem `u`).
  - `odkazyPrehledu(html: string, zakladUrl: string, vzor: string): string[]` – absolutní URL z `a[href]`, přes `normalizujUrl` (úkol 1), filtrované vzorem, unikátní, seřazené.
  - `otisk(data: string|Buffer): string` – SHA-256 hex.
  - `verzePravidel(pravidlaDomeny: object|undefined): string` – otisk z `JSON.stringify(pravidla ?? {})` + konstanty `VERZE_CISTENI = 1` (zvýšit při změně algoritmu).
  - `jeHtml(contentType: string|null): boolean`.
- Consumes: `normalizujUrl` z úkolu 1.

- [ ] **Step 1: Testy**

```js
test('detail DDM: změna volných míst nemění otisk', ...)
  // dva HTML podle struktury z ddmhorice.cz (div#krouzky_detail > table > tr.radek > td×2),
  // liší se jen řádkem „Volná místa | Poslední 3 místa“ vs „Volná místa | Obsazeno“;
  // pravidla {obsah:'#krouzky_detail', odstranitRadky:['^Volná místa\\b']} → otisk(htmlNaText(a)) === otisk(htmlNaText(b))
test('detail DDM: změna času mění otisk', ...)   // „ÚT 16:00-17:00“ vs „ÚT 16:30-17:30“ → různé
test('menu a patička se ignorují', ...)           // změna v <nav>/<footer> nemění text
test('windows-1250 podle hlavičky i podle meta', ...)
  // Buffer.from([0x9e,0x6c,0x75,0x9d,0x6f,0x75,0xe8,0x6b,0xfd]) = „žluťoučký“ v cp1250;
  // dekoduj(buf, 'text/html; charset=windows-1250') === 'žluťoučký'; totéž přes <meta charset="windows-1250"> v těle
test('odkazyPrehledu vrací absolutní, unikátní, seřazené odkazy podle vzoru', ...)
  // href './krouzky/1000-latino-kids' na základu 'https://www.ddmhorice.cz/krouzky' → 'https://www.ddmhorice.cz/krouzky/1000-latino-kids'; odkaz '/kontakty' vynechán
test('verzePravidel se mění se změnou pravidel', ...)
```

- [ ] **Step 2: Spustit, ověřit selhání.**
- [ ] **Step 3: `npm install -D node-html-parser`, implementace.**
- [ ] **Step 4: Testy projdou** – `node --test tests/monitor-cisteni.test.mjs`.
- [ ] **Step 5: Commit** – `"Monitoring: čištění obsahu a otisky"`

### Úkol 3: robots.txt

**Files:**
- Create: `scripts/monitor/robots.mjs`
- Test: `tests/monitor-robots.test.mjs`

**Interfaces:**
- Produces: `parsujRobots(text: string, userAgent: string): { povoleno(cesta: string): boolean, crawlDelay: number|null }` – vybere skupinu, jejíž `User-agent` je podřetězcem našeho UA (bez ohledu na velikost písmen, token `KrouzkyHorice-monitor`), jinak `*`. Pravidla `Allow`/`Disallow` jako prefixy, vyhrává nejdelší shoda, při shodné délce `Allow`. Podpora `*` a `$` ve vzorech. `Crawl-delay` z vybrané skupiny, jinak globální (mimo skupiny, jako u DDM).
- Produces: `robotsZOdpovedi(status: number|null, text: string|null, ua): { stav: 'ok'|'nedostupny', pravidla }` – 2xx = parsovat, 4xx = vše povoleno, 5xx / `null` (síťová chyba) = `nedostupny`.

- [ ] **Step 1: Testy**

```js
test('DDM robots: náš UA nezakázán, crawlDelay 1', ...)   // obsah: 'Crawl-delay: 1\n\nUser-agent: MJ12Bot\nDisallow: /\n' → povoleno('/krouzky') true, crawlDelay 1
test('Disallow pro * zakazuje, delší Allow povoluje', ...)
test('skupina pro náš UA má přednost před *', ...)
test('404 = vše povoleno, 503 a síťová chyba = nedostupný', ...)
```
- [ ] **Step 2–4:** selhání → implementace → `node --test tests/monitor-robots.test.mjs` PASS.
- [ ] **Step 5: Commit** – `"Monitoring: robots.txt"`

### Úkol 4: Stahování a plánovač po doménách

**Files:**
- Create: `scripts/monitor/stahovani.mjs`
- Test: `tests/monitor-stahovani.test.mjs`

**Interfaces:**
- Produces:
  - `stahni(url, { druh, etag, lastModified }, { fetchFn = fetch, ua, timeoutMs = 20000, maxBajtu = 10*1024*1024 }): Promise<Vysledek>`, kde `Vysledek = { status: number|null, beZmeny: boolean, telo: Buffer|null, contentType: string|null, etag: string|null, lastModified: string|null, konecnaUrl: string, trvalePresmerovano: boolean, chyba: null | { druh, status } }`.
    - `druh === 'dostupnost'`: `HEAD`. Při 405/501 `GET`, tělo se nečte (`body.cancel()`).
    - jinak `GET` s `If-None-Match`/`If-Modified-Since`, když jsou. `304` → `beZmeny: true`.
    - Přesměrování ručně (`redirect: 'manual'`), max. 5. `trvalePresmerovano` = cokoli v řetězu bylo 301/308 a `konecnaUrl` se liší od `url` (po `normalizujUrl`).
    - Klasifikace chyb: 404, 410, 5xx (→ `'5xx'`), 403/429 → `'odmitnuto'`, `AbortError` → `'timeout'`, `ENOTFOUND`/`EAI_AGAIN` → `'dns'`, kódy `CERT_*`/`*_SELF_SIGNED_*`/`UNABLE_TO_VERIFY_*` v `cause.code` → `'certifikat'`, tělo nad limit → `'prilis-velke'`, ostatní síťové → `'sit'`.
  - `zpracujPoDomenach(polozky: {url}[], zpracuj: (polozka) => Promise<T>, { pauzaProDomenu: (hostname) => number, cekej = (ms) => setTimeout-promise }): Promise<T[]>` – fronta pro každou doménu běží sekvenčně s pauzou **mezi** požadavky, domény souběžně. Pořadí výsledků = pořadí vstupu.
- Consumes: `normalizujUrl` (úkol 1).

- [ ] **Step 1: Testy** (s falešným `fetchFn`, který vrací `new Response(...)`, a falešným `cekej`, který jen zaznamenává ms)

```js
test('304 → beZmeny, bez těla', ...)
test('posílá If-None-Match a If-Modified-Since', ...)            // zachycené hlavičky
test('dostupnost: HEAD, při 405 GET', ...)                         // pořadí metod ['HEAD','GET']
test('301 na jinou URL → trvalePresmerovano a konecnaUrl', ...)   // Review Focus 2
test('302 → není trvalé', ...)
test('403 a 429 → odmitnuto, 404 → 404, 503 → 5xx', ...)
test('tělo nad limit → prilis-velke', ...)
test('plánovač: stejná doména sekvenčně s pauzou, různé souběžně', ...)
  // 3 URL na a.cz, 1 na b.cz, pauza 5000 → cekej volán 2× s 5000 (jen mezi požadavky na a.cz)
```
- [ ] **Step 2–4:** selhání → implementace → PASS.
- [ ] **Step 5: Commit** – `"Monitoring: stahování a plánovač po doménách"`

### Úkol 5: Vyhodnocení stavu

**Files:**
- Create: `scripts/monitor/stav.mjs`
- Test: `tests/monitor-stav.test.mjs`

**Interfaces:**
- Consumes: tvary z úkolů 1, 2, 4.
- Produces:
  - `prazdnyStav(): Stav` – `{ verze: 1, posledniBeh: null, zapatiDatum: null, url: {} }`.
  - `vyhodnotBeh({ predchozi: Stav, seznam: Map (úkol 1), mereni: Map<url, Mereni>, ignorovane: string[], znameZdroje: Set<string>, dnes: string }): { stav: Stav, nalezy: Nalezy }`
    - `Mereni = { vysledek: Vysledek (úkol 4) | null, otisk: string|null, odkazy: string[]|null, verzePravidel: string, preskoceno: null | 'robots' | 'robots-nedostupny' }`
    - `Nalezy = { zkontrolovano: number, beZmeny304: number, noveSledovano: number, prepocitano: number, preskoceno: {url, duvod}[], zmeny: { nove: Polozka[], pretrvavajici: Polozka[] }, chyby: { nove, pretrvavajici }, odmitnuto: { nove, pretrvavajici }, prehledy: { nove: {url, prehled}[], zrusene: {url, prehled}[], pretrvavajici: number }, presmerovani: { nove: Polozka[] } }`, `Polozka = { url, pouziti, druh?, status? }`.
  - `potvrd(stav: Stav, urls: string[] | 'vse', dnes): Stav` – `otiskPotvrzeny = otiskPosledni`, `odkazyPotvrzene = odkazyPosledni`, `zmena = null`, `posledniOk = dnes`.

  Pravidla (všechna musí mít test):
  1. URL bez záznamu → uloží se `otiskPotvrzeny = otisk`, `odkazyPotvrzene = odkazy`, `posledniOk = dnes`, počítá se do `noveSledovano`, nic se nehlásí.
  2. `verzePravidel` se liší od uložené → stejné jako 1, ale počítá se do `prepocitano`.
  3. `beZmeny` (304) → `otiskPosledni` se nemění, stav změny zůstává, jak byl.
  4. `otisk !== otiskPotvrzeny`: když `predchozi.zmena?.otisk === otisk`, jde o **přetrvávající** změnu, jinak o **novou** (`zmena = {od: dnes, otisk}`, při opakované změně se `od` zachová). Když `otisk === otiskPotvrzeny` → `zmena = null` (stránka se vrátila).
  5. Chyba (`vysledek.chyba`, druh ≠ `odmitnuto`): `pocet = předchozí (stejný druh ? pocet : 0) + 1`, `od` zachovat. Při `pocet === 2` je **nová**, při `> 2` **přetrvávající**, při 1 se nehlásí. Úspěch → `chyba = null`. `odmitnuto` se hlásí stejně, ale do `odmitnuto`.
  6. Přehled: nové odkazy = `odkazy − odkazyPotvrzene − ignorovane − znameZdroje`. Zrušené = `odkazyPotvrzene − odkazy`. Odkaz, který byl nový/zrušený už v minulém běhu (`odkazyPosledni`), je přetrvávající (jen počet). Když nejsou nové ani zrušené, `odkazyPotvrzene = odkazy`.
  7. `posledniOk = dnes`, když je výsledek bez chyby a `zmena === null`.
  8. `trvalePresmerovano` → `presmerovani = konecnaUrl`. Hlásí se jako nové jen tehdy, když se liší od uloženého.
  9. URL v `predchozi`, které nejsou v `seznam`, se ze stavu odstraní.
  10. `zapatiDatum = dnes`, když po běhu nemá žádná URL druhu `obsah`/`prehled` `zmena !== null`, ani nemá nevyřešené nové/zrušené odkazy. Jinak se zachová předchozí. `posledniBeh = dnes`.
  11. Přeskočené URL (`preskoceno`) se nemění kromě `posledniKontrola`, jdou do `nalezy.preskoceno`.

- [ ] **Step 1: Testy** – jeden test na každé pravidlo 1–11 (název = číslo + krátký popis, např. `'4: druhý běh se stejnou změnou je přetrvávající'`), plus:

```js
test('potvrd přenese poslední otisk a odkazy a vynuluje změnu', ...)
test('vyhodnotBeh nemutuje predchozi', ...)   // deepEqual předchozí před/po (structuredClone)
```
- [ ] **Step 2–4:** selhání → implementace → `node --test tests/monitor-stav.test.mjs` PASS.
- [ ] **Step 5: Commit** – `"Monitoring: vyhodnocení stavu"`

### Úkol 6: Souhrn, kontrola.json a CLI

**Files:**
- Create: `scripts/monitor/souhrn.mjs`, `scripts/monitor/kontrola-webu.mjs`, `scripts/monitor/git-stav.mjs`, `scripts/monitor.mjs`
- Modify: `package.json` (`"monitor": "node scripts/monitor.mjs"`), `.gitignore` (`.monitor-stav/`, `.monitor-vystup/`)
- Test: `tests/monitor-souhrn.test.mjs`, `tests/monitor-kontrola-webu.test.mjs`, `tests/monitor-cli.test.mjs`

**Interfaces:**
- Consumes: všechno z úkolů 1–5.
- Produces:
  - `sestavIssue(nalezy: Nalezy, dnes: string): { nazev: string, telo: string, zavrit: boolean }`
    - Název: `Kontrola zdrojů {dnes}: {části}` s částmi `N nové změny`, `N nové nefunkční odkazy`, `N nové kroužky v přehledech` … (jen nenulové, české tvary 1 / 2–4 / 5+ jako ve `validate.mjs`), nebo `bez nových problémů`.
    - Tělo podle spec 5.6: věta `Zkontrolováno {n} URL (z toho {m} beze změny přes 304).`, tabulka (řádky: Změněné zdroje, Nefunkční odkazy, Server odmítl kontrolu, Nové / zrušené kroužky v přehledech, Přesměrované odkazy, Přeskočeno), pak sekce jen pro nové položky (`- {url} – {status/druh} – {id} ({pole}), …`), pak `<details><summary>Přetrvávající problémy (N)</summary>` se seznamem URL. Řádek `Nově sledováno: N · přepočítáno po změně pravidel: M`, když nenulové. Na konci návod `Vyřešit: napiš agentovi „vyřeš issue #…“.`
    - `zavrit = true`, když nejsou žádné nové položky v žádné kategorii.
  - `sestavKontrolu(stav: Stav, seznam: Map): { zdrojeZkontrolovany: string|null, url: Record<string,string> }` – pro URL s `pouziti` obsahujícím pole `zdroj_url` a `posledniOk != null`. Klíče seřazené.
  - `scripts/monitor.mjs` CLI:
    - `node scripts/monitor.mjs --stav <adresář> --vystup <adresář>`: načte data a `monitor.json`, `stav.json` (když chybí → `prazdnyStav()`), změří vše (robots se stahuje 1× na doménu, pak `zpracujPoDomenach`), vyhodnotí, **až poté** zapíše `<stav>/stav.json` atomicky (`.tmp` + `rename`), `site/data/kontrola.json`, `<vystup>/issue-nazev.txt`, `<vystup>/issue.md`, `<vystup>/zavrit` (obsah `true`/`false`). Exit 0 i při nálezech, exit 1 jen při pádu.
    - `--potvrdit <url…>` / `--potvrdit-vse`: přes `git-stav.mjs` vytvoří worktree `origin/monitor-stav` v dočasném adresáři, aplikuje `potvrd`, zapíše `stav.json` a `site/data/kontrola.json` (v pracovním stromu `main`, commitne ho agent spolu s daty), commitne do `monitor-stav` (`Potvrzení: N URL`) a pushne. Při odmítnutí udělá `git pull --rebase` a push zopakuje (max. 3×). Na konci worktree odstraní.
  - `git-stav.mjs`: `sGitStavem(fn: (adresar) => Promise<string /*commit msg*/>, { spust = execFile })` – obal kolem worktree, commitu a pushe s opakováním. `spust` jde nahradit v testu.

- [ ] **Step 1: Testy**

```js
// monitor-souhrn
test('bez nových problémů: název „… bez nových problémů“, zavrit true, tabulka s počty přetrvávajících', ...)
test('nová změna a nový nefunkční odkaz: název s oběma částmi, sekce s URL a id, zavrit false', ...)
test('tělo neobsahuje nic kromě URL, id, polí, kódů a čísel', ...)   // vstup s pouziti/URL; žádné jiné řetězce se neobjeví
test('české tvary: 1 nová změna, 2 nové změny, 5 nových změn', ...)
// monitor-kontrola-webu
test('jen zdroj_url s posledniOk, seřazené klíče, zdrojeZkontrolovany = zapatiDatum', ...)
// monitor-cli
test('při výjimce během měření se stav.json nezapíše', ...)   // Review Focus 5: fetch vyhodí v polovině, soubor neexistuje / nezměněn
test('git-stav: při odmítnutém pushi pull --rebase a opakování, po 3 neúspěších výjimka', ...)
```
CLI test spouští hlavní funkci exportovanou z `scripts/monitor.mjs` (`export async function behKontroly({ koren, stavAdresar, vystupAdresar, fetchFn, cekej, dnes })`) nad dočasným adresářem s malými daty a falešným `fetchFn`. Spouštění z příkazové řádky stejným vzorem jako ve `validate.mjs` (`import.meta.url === pathToFileURL(process.argv[1]).href`).

- [ ] **Step 2–4:** selhání → implementace → `npm test` PASS.
- [ ] **Step 5: Ruční ověření** – `npm run monitor -- --stav .monitor-stav --vystup .monitor-vystup` lokálně (proběhne skutečný první běh, asi 6–10 minut). Očekávání: `issue-nazev.txt` = `Kontrola zdrojů {dnes}: bez nových problémů` (první běh jen ukládá výchozí stav), v `issue.md` je `Nově sledováno: ~180`, `kontrola.json` obsahuje dnešní datum pro všechny dostupné `zdroj_url`. Pak hned druhý běh: stále bez nových problémů a velká část požadavků jako 304 nebo se stejným otiskem. **Pokud druhý běh hlásí změny, jde o šum. Doplň pravidla do `monitor.json` (úkol 1) a opakuj.**
- [ ] **Step 6: Commit** – `"Monitoring: souhrn do issue, kontrola.json a CLI"` (bez `.monitor-*` adresářů).

### Úkol 7: „Data načtena“ na webu a validace kontrola.json

**Files:**
- Create: `schema/kontrola.schema.json`, `site/data/kontrola.json` (výstup z úkolu 6, krok 5)
- Modify: `site/js/data.js`, `site/js/render.js:257-263`, `site/js/app.js:199`, `scripts/validate.mjs`
- Test: `tests/data-nacteni.test.mjs`, `tests/validate.test.mjs`, `tests/schema.test.mjs`

**Interfaces:**
- Produces (v `site/js/data.js`):
  - `datumNacteni(aktivita, kontrola: object|null): string` – pozdější z `aktivita.overeno` a `kontrola?.url?.[aktivita.zdroj_url]`.
  - `datumNacteniWebu(meta, kontrola): string` – pozdější z `meta.aktualizovano` a `kontrola?.zdrojeZkontrolovany`.
  - `nactiData()` navíc vrací `kontrola` (při chybě načtení `kontrola.json` → `null`, web funguje dál).
- Render: patička karty `Data načtena {datum}` (nahrazuje `Ověřeno …`), varování „Údaje mohou být zastaralé“ se počítá z `datumNacteni`. Zápatí: `Data načtena {datum}.` (nahrazuje „Data aktualizována …“). `render.js` dostane `kontrola` stejnou cestou, jakou dnes dostává `dnes`.
- Validace: schéma `kontrola` (`zdrojeZkontrolovany`: date|null, `url`: objekt s hodnotami date, `additionalProperties: false`). Logická kontrola: datum v budoucnosti = chyba. Klíč `url`, který není `zdroj_url` žádné aktivity = varování. Soubor chybí → v pořádku.

- [ ] **Step 1: Testy**

```js
test('datumNacteni bere pozdější z overeno a kontroly', ...)   // overeno '2026-10-19', kontrola '2026-10-25' → '2026-10-25'; bez kontroly → '2026-10-19'
test('datumNacteniWebu', ...)
test('kontrola.json: datum v budoucnosti je chyba, neznámá URL varování', ...)   // ve validate.test.mjs přes zkontrolujData({..., kontrola})
test('schéma kontrola: neznámé pole neprojde', ...)                           // ve schema.test.mjs
```
- [ ] **Step 2–4:** selhání → implementace → `npm test` a `npm run validate` PASS.
- [ ] **Step 5: Ruční ověření** – `npm run dev`, na kartě je „Data načtena …“ a v zápatí „Data načtena ….“. Když dočasně přejmenuješ `kontrola.json`, web dál funguje a zobrazuje `overeno`.
- [ ] **Step 6: Commit** – `"Web: jedno datum „Data načtena“ podle ruční aktualizace i kontroly zdrojů"`

### Úkol 8: Workflow a dokumentace postupu

**Files:**
- Create: `.github/workflows/monitor.yml`
- Modify: `CLAUDE.md` (nová sekce „Monitoring zdrojů a řešení issue“)

**Interfaces:**
- Consumes: CLI z úkolu 6.

- [ ] **Step 1: Workflow** `.github/workflows/monitor.yml`:
  - `on: schedule: - cron: '17 2 */3 * *'` + `workflow_dispatch`.
  - `permissions: contents: write, issues: write, actions: write`, `concurrency: { group: monitor, cancel-in-progress: false }`.
  - Kroky:
    1. `actions/checkout@v4` (`main`)
    2. `setup-node` (`lts/*`, cache npm), `npm ci`
    3. checkout větve `monitor-stav` do `.monitor-stav` (`actions/checkout@v4` s `ref: monitor-stav`, `path: .monitor-stav`). Když větev neexistuje, vytvoří se orphan větev s prázdným adresářem (krok se `continue-on-error` + `git init` fallback, nebo `git ls-remote` test).
    4. `node scripts/monitor.mjs --stav .monitor-stav --vystup .monitor-vystup`
    5. commit `stav.json` do `monitor-stav` a push. Při odmítnutí `pull --rebase` a opakování (max. 3×).
    6. když se změnil `site/data/kontrola.json`: commit do `main` (`Kontrola zdrojů {datum}`, autor `github-actions[bot]`), push se stejným opakováním, pak `gh workflow run deploy.yml --ref main`. **Push přes `GITHUB_TOKEN` nespouští jiné workflowy, proto nasazení výslovně.**
    7. `gh label create monitoring --force`, `gh issue create --title "$(cat .monitor-vystup/issue-nazev.txt)" --body-file .monitor-vystup/issue.md --label monitoring`. Když je `zavrit == true`, `gh issue close <číslo> --reason completed`.
- [ ] **Step 2: Ověření syntaxe** – `npx --yes actionlint` (nebo binárka `actionlint`), když je dostupná. Jinak ruční kontrola podle ostatních workflowů v `.github/workflows/`.
- [ ] **Step 3: CLAUDE.md** – sekce: co monitoring dělá, kde je stav, postup „vyřeš issue #N“ (spec 5.7): přečíst issue, otevřít dotčené URL, opravit data podle pravidel, `npm run validate`, `npm test`, `npm run monitor -- --potvrdit <url…>` (u nových kroužků DDM, které se nepřidávají, doplnit `ignorovaneOdkazy` v `monitor.json`), commit s `Closes #N`. Dál vysvětlit, že `overeno` znamená ruční ověření a „Data načtena“ se počítá automaticky.
- [ ] **Step 4: `npm test` a `npm run validate`** – PASS.
- [ ] **Step 5: Commit** – `"Monitoring: plánovaný běh v GitHub Actions a postup řešení issue"`
- [ ] **Step 6: Spuštění na GitHubu – jen se souhlasem uživatele.** Push do `main` nasazuje web. Po pushi ručně spustit workflow (`gh workflow run monitor.yml`) a ověřit: vznikla větev `monitor-stav`, issue „bez nových problémů“ je založené a zavřené, přišel e-mail, proběhlo nasazení s `kontrola.json`.

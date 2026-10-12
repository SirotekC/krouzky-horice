# Fáze 1: Zahájení implementace (MVP)

> **Tento dokument je zadání pro AI agenta nebo vývojáře.** Je samostatný: obsahuje kontext, omezení, datové schéma, strukturu souborů, úkoly v pořadí a kritéria přijetí.
> Kontext celého projektu: [`PLAN.md`](./PLAN.md).
> Verze 1.0 (2026-10-09)

---

## 0. Instrukce pro agenta (čti jako první)

1. **Cíl fáze 1:** funkční statická webová stránka s **ručně připravenými** reálnými daty pro 5–10 organizací jednoho města, nasazená na GitHub Pages.
2. **Postupuj podle úkolů v sekci 6 v uvedeném pořadí.** Po každém úkolu ověř jeho kritéria přijetí a teprve pak pokračuj.
3. **Dodržuj omezení v sekci 2.** Hlavně nepoužívej frameworky ani build krok a neimplementuj automatické stahování webů, to patří do fáze 3.
4. **Zástupné hodnoty:** `{MĚSTO}` = název města, `{GITHUB_USER}` = uživatelské jméno na GitHubu, `{REPO}` = název repozitáře (doporučeno `krouzky-{mesto}`). Pokud je neznáš, zeptej se uživatele. Neodhaduj je.
5. **Data nevymýšlej.** Každý údaj musí pocházet z uvedeného `zdroj_url`. Pokud údaj na webu není, pole vynech nebo nastav na `null`. Nikdy nedoplňuj odhad.
6. Texty v UI piš česky. Identifikátory v kódu mohou být české (konzistentní s daty) nebo anglické, ale v rámci projektu jednotně. **Datová pole jsou česky, viz schéma.**
7. Commituj po logických celcích se srozumitelnou zprávou v češtině.

---

## 1. Kontext v kostce

- Stránka sjednocuje informace o kroužcích pro děti z různých webů (ZUŠ, DDM, sportovní kluby, spolky).
- Prohlížeč nemůže kvůli CORS číst cizí weby přímo. Data proto leží jako **statický JSON v repozitáři** a stránka je jen načítá.
- Ve fázi 1 se data plní **ručně**, případně s pomocí agenta, který zdrojové weby přečte a údaje opíše. Automatizace přijde ve fázích 3 a 4.
- Hlavní hodnota pro uživatele je odpověď na otázku **„Kam můžu přihlásit své X-leté dítě a jak/kdy se přihlašuje?“**

---

## 2. Omezení a technická rozhodnutí

| Pravidlo | Detail |
|---|---|
| Bez frameworku | Čisté HTML, CSS a JavaScript (ES moduly, `<script type="module">`). |
| Bez build kroku | Web musí fungovat přímo ze složky `site/`, bez kompilace. |
| Bez runtime závislostí z CDN | Ve fázi 1 žádné externí knihovny ve frontendu. |
| Node.js jen pro nástroje | Validace dat a lokální server. Závislosti jen v `devDependencies` (`ajv`, `ajv-formats`). |
| Data | `site/data/organizace.json`, `site/data/aktivity.json`. Zdroj pravdy je v gitu. |
| Podpora prohlížečů | Poslední 2 verze Chrome, Firefox, Safari a Edge, včetně mobilních. |
| Mobile first | Návrh od šířky 360 px. |
| Přístupnost | Sémantické HTML, ovládání klávesnicí, popisky formulářových prvků, kontrast WCAG AA. |
| Výkon | Celá stránka bez dat < 50 kB, žádné blokující externí zdroje. |
| Mimo rozsah fáze 1 | Mapa, scraping, AI extrakce, uživatelské účty, backend, analytika, cookies. |

---

## 3. Struktura repozitáře

```
krouzky-{mesto}/
├── README.md                    # popis projektu, jak spustit lokálně, jak přidat data
├── PLAN.md                      # celkový plán (tento projekt)
├── FAZE-1-IMPLEMENTACE.md       # tento dokument
├── LICENSE                      # MIT pro kód
├── package.json                 # skripty: dev, validate
├── .gitignore                   # node_modules/, .DS_Store
├── .github/
│   └── workflows/
│       ├── validate.yml         # validace dat při každém push/PR
│       └── deploy.yml           # nasazení site/ na GitHub Pages (push do main)
├── schema/
│   ├── organizace.schema.json
│   └── aktivity.schema.json
├── scripts/
│   └── validate.mjs             # validace dat + referenční integrita
├── data-src/
│   └── zdroje.md                # soupis zdrojů a poznámky z ručního sběru
└── site/                        # vše, co se publikuje
    ├── index.html
    ├── o-projektu.html
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js               # vstupní bod, načtení dat, propojení
    │   ├── data.js              # načtení a příprava dat
    │   ├── filters.js           # logika filtrování a vyhledávání (čisté funkce)
    │   ├── registration.js      # výpočet stavu přihlášek (čisté funkce)
    │   ├── render.js            # vykreslení karet a prázdných stavů
    │   └── url-state.js         # synchronizace filtrů s URL
    ├── data/
    │   ├── organizace.json
    │   ├── aktivity.json
    │   └── meta.json            # { "mesto": "...", "aktualizovano": "YYYY-MM-DD" }
    └── favicon.svg
```

---

## 4. Datový model

### 4.1 Organizace (`site/data/organizace.json`)

Pole objektů:

```json
[
  {
    "id": "zus-mesto",
    "nazev": "Základní umělecká škola {MĚSTO}",
    "typ": "zus",
    "web": "https://www.zus-mesto.cz",
    "email": "info@zus-mesto.cz",
    "telefon": "+420 123 456 789",
    "adresa": "Hlavní 1, 123 45 {MĚSTO}",
    "popis": "Hudební, výtvarný, taneční a literárně-dramatický obor.",
    "zdroj_url": "https://www.zus-mesto.cz/kontakty",
    "overeno": "2026-10-09"
  }
]
```

| Pole | Typ | Povinné | Poznámka |
|---|---|---|---|
| `id` | string | ano | `^[a-z0-9-]+$`, unikátní, stabilní (nemění se) |
| `nazev` | string | ano | Oficiální název |
| `typ` | enum | ano | `zus`, `ddm`, `sportovni-klub`, `spolek`, `skola`, `jine` |
| `web` | URL | ano | Hlavní web organizace |
| `email` | string\|null | ne | **Jen obecný kontakt**, ne osobní e-mail trenéra |
| `telefon` | string\|null | ne | Obecný kontakt |
| `adresa` | string\|null | ne | Sídlo |
| `popis` | string\|null | ne | Max. 300 znaků, vlastními slovy (nekopírovat texty) |
| `zdroj_url` | URL | ano | Odkud údaje pocházejí |
| `overeno` | date | ano | `YYYY-MM-DD`, kdy byly údaje naposledy ověřeny |

### 4.2 Aktivita (`site/data/aktivity.json`)

Pole objektů:

```json
[
  {
    "id": "zus-mesto-klavir",
    "organizace_id": "zus-mesto",
    "nazev": "Hra na klavír",
    "kategorie": ["hudba"],
    "popis": "Individuální výuka hry na klavír.",
    "vek_od": 7,
    "vek_do": 18,
    "misto": {
      "nazev": "Hlavní budova ZUŠ",
      "adresa": "Hlavní 1, 123 45 {MĚSTO}",
      "gps": null
    },
    "terminy": {
      "text": "Dle individuálního rozvrhu, Po–Pá odpoledne",
      "dny": ["po", "ut", "st", "ct", "pa"]
    },
    "cena": {
      "text": "1 800 Kč za pololetí",
      "castka_kc": 1800,
      "obdobi": "pololeti"
    },
    "prihlaska": {
      "zpusob": "Talentové zkoušky, poté elektronická přihláška.",
      "od": "2027-05-01",
      "do": "2027-06-15",
      "prubezne": false,
      "odkaz": "https://www.zus-mesto.cz/prijimaci-rizeni",
      "poznamka": "Přesné termíny zkoušek škola zveřejňuje v dubnu."
    },
    "skolni_rok": "2026/2027",
    "zdroj_url": "https://www.zus-mesto.cz/hudebni-obor",
    "overeno": "2026-10-09"
  }
]
```

| Pole | Typ | Povinné | Poznámka |
|---|---|---|---|
| `id` | string | ano | `^[a-z0-9-]+$`, unikátní. Doporučený tvar `{organizace_id}-{slug}` |
| `organizace_id` | string | ano | Musí existovat v `organizace.json` |
| `nazev` | string | ano | |
| `kategorie` | enum[] | ano | min. 1 hodnota, viz 4.3 |
| `popis` | string\|null | ne | Max. 300 znaků, vlastními slovy |
| `vek_od` | integer\|null | ne | 0–26. `null` = neuvedeno |
| `vek_do` | integer\|null | ne | 0–26, ≥ `vek_od` |
| `misto` | object\|null | ne | `nazev`, `adresa`, `gps` (`[lat, lon]` nebo `null`, využije se ve fázi 2) |
| `terminy.text` | string\|null | ne | Volný text, jak je uveden u zdroje |
| `terminy.dny` | enum[] | ne | `po`, `ut`, `st`, `ct`, `pa`, `so`, `ne` |
| `cena.text` | string\|null | ne | Volný text |
| `cena.castka_kc` | number\|null | ne | Pro budoucí filtr ceny |
| `cena.obdobi` | enum\|null | ne | `lekce`, `mesic`, `pololeti`, `rok`, `jednorazove`, `zdarma` |
| `prihlaska.zpusob` | string | ano | Jak se přihlásit. Pokud není známo: `"Informace na webu organizace."` |
| `prihlaska.od` | date\|null | ne | Začátek přihlašování |
| `prihlaska.do` | date\|null | ne | Konec přihlašování |
| `prihlaska.prubezne` | boolean | ano | `true` = lze se přihlásit kdykoli během roku |
| `prihlaska.odkaz` | URL\|null | ne | Přímý odkaz na přihlášku nebo informace |
| `prihlaska.poznamka` | string\|null | ne | |
| `skolni_rok` | string\|null | ne | `^\d{4}/\d{4}$` |
| `zdroj_url` | URL | ano | |
| `overeno` | date | ano | `YYYY-MM-DD` |

### 4.3 Číselník kategorií

| Klíč | Popisek v UI |
|---|---|
| `hudba` | Hudba |
| `vytvarne` | Výtvarné a rukodělné |
| `tanec` | Tanec |
| `divadlo` | Divadlo a literatura |
| `sport-mickove` | Míčové sporty |
| `sport-ostatni` | Ostatní sporty |
| `bojove` | Bojová umění |
| `plavani` | Plavání a vodní sporty |
| `priroda` | Příroda a skauting |
| `technika` | Technika, programování, robotika |
| `veda` | Věda a vzdělávání |
| `jazyky` | Jazyky |
| `ostatni` | Ostatní |

Číselník je definovaný na jednom místě v `site/js/data.js` (popisky) a jako `enum` ve schématu. **Obě místa musí souhlasit.** Validační skript to kontroluje (úkol 4).

### 4.4 Meta (`site/data/meta.json`)

```json
{ "mesto": "{MĚSTO}", "aktualizovano": "2026-10-09", "verze_schematu": 1 }
```

---

## 5. Funkční požadavky na stránku

### 5.1 Hlavní stránka (`index.html`)

**Hlavička:** název „Kroužky {MĚSTO}“, krátký podtitul („Všechny kroužky pro děti na jednom místě“) a odkaz „O projektu“.

**Panel filtrů:**

| Filtr | Prvek | Chování |
|---|---|---|
| Vyhledávání | `<input type="search">` | Hledá v `nazev`, `popis`, názvu organizace a popiscích kategorií. Bez ohledu na diakritiku a velikost písmen. S debounce 150 ms. |
| Věk dítěte | `<input type="number" min="0" max="26">` | Zobrazí aktivity, kde `vek_od ≤ věk ≤ vek_do`. Chybějící `vek_od` se bere jako 0 a chybějící `vek_do` jako 99. Prázdné pole znamená bez filtru. |
| Kategorie | Skupina zaškrtávacích tlačítek (chips) | Více najednou, logika **OR**. Žádná vybraná znamená vše. |
| Organizace | `<select>` | Jedna nebo „Všechny“. |
| Stav přihlášek | `<select>` | „Vše“ / „Přihlášky probíhají“ / „Brzy začnou (do 30 dní)“ / „Průběžný nábor“. |
| Reset | tlačítko | Vymaže všechny filtry. |

Mezi skupinami filtrů platí logika **AND**.

**Výsledky:**

- Počet výsledků („Nalezeno 12 kroužků“), oznámený přes `aria-live="polite"`.
- Řazení: nejdřív aktivity se stavem „probíhá“, pak „brzy“, „průběžně“, „neznámý“ a „ukončeno“. V rámci stavu abecedně podle `nazev` (`localeCompare` s `'cs'`).
- Karta aktivity obsahuje:
  - název, organizaci a štítky kategorií,
  - **štítek stavu přihlášek** (barva a text, ne jen barva),
  - věk („7–18 let“, „od 5 let“, „do 12 let“, nebo nic),
  - místo, termíny a cenu (pouze pokud jsou vyplněné),
  - blok **„Jak se přihlásit“**: `zpusob`, období („1. 5. – 15. 6. 2027“), `poznamka` a tlačítko „Přihláška / více informací“ na `prihlaska.odkaz`, nebo na `zdroj_url`, když odkaz chybí,
  - patičku: „Zdroj: {doména}“ jako odkaz na `zdroj_url` a „Ověřeno {d. m. rrrr}“.
  - Pokud je `overeno` starší než 90 dní, zobrazí se jemné upozornění „Údaje mohou být zastaralé“.
- Prázdný stav: „Žádný kroužek neodpovídá filtrům.“ a tlačítko „Zrušit filtry“.
- Chybový stav (data se nenačetla): srozumitelná hláška a odkaz na obnovení stránky.
- Stav načítání: jednoduchý text nebo skeleton.

**Patička:** „Informace ověřujte u pořadatele.“, datum poslední aktualizace z `meta.json`, odkaz na nahlášení chyby (`mailto:` nebo GitHub Issues) a odkaz na repozitář.

### 5.2 Stav přihlášek (`registration.js`)

Čistá funkce `stavPrihlasky(prihlaska, dnes) → { stav, text }`. Parametr `dnes` je předáván kvůli testovatelnosti.

| Podmínka (vyhodnocovat v tomto pořadí) | `stav` | `text` v UI |
|---|---|---|
| `od` a `do` vyplněné a `od ≤ dnes ≤ do` | `probiha` | „Přihlášky do {d. m.}“ (pokud zbývá ≤ 7 dní: „Končí za X dní“) |
| `od` vyplněné, `dnes < od` a rozdíl ≤ 30 dní | `brzy` | „Přihlášky od {d. m.}“ |
| `od` vyplněné, `dnes < od` a rozdíl > 30 dní | `planovano` | „Přihlášky od {d. m. rrrr}“ |
| jen `do` vyplněné (bez `od`) a `dnes ≤ do` | `probiha` | jako výše |
| `prubezne === true` | `prubezne` | „Průběžný nábor“ |
| `do` vyplněné a `dnes > do` | `ukonceno` | „Přihlášky ukončeny“ |
| jinak | `neznamy` | „Termín přihlášek neuveden“ |

Pozor na tyto případy:

- `prubezne` se kontroluje **před** `ukonceno`: když termín hlavního náboru skončil, ale klub bere děti průběžně, zobrazí se „Průběžný nábor“. Pokryj to testem.
- Data porovnávej jako kalendářní dny v časovém pásmu Europe/Prague, bez času. Datum `YYYY-MM-DD` parsuj ručně, ne přes `new Date('YYYY-MM-DD')`, které ho bere jako UTC.

Pro filtr „Stav přihlášek“ platí: „probíhají“ = `probiha`, „brzy začnou“ = `brzy`, „průběžný nábor“ = `prubezne`.

### 5.3 Stav v URL (`url-state.js`)

- Filtry se ukládají do query stringu, např. `?q=klavir&vek=8&kat=hudba,tanec&org=zus-mesto&stav=probiha`.
- Při načtení stránky se filtry obnoví z URL. Při změně filtru se použije `history.replaceState`, takže nevznikají nové položky historie.
- Neplatné hodnoty z URL se tiše ignorují.

### 5.4 Stránka „O projektu“ (`o-projektu.html`)

- Co projekt dělá a proč.
- Odkud data pocházejí (seznam organizací generovaný z `organizace.json` s odkazy).
- Upozornění na přesnost a výzva „ověřte u pořadatele“.
- Jak nahlásit chybu nebo požádat o odstranění.
- Informace o osobních údajích: neuvádíme osobní kontakty, nepoužíváme cookies ani sledování.

### 5.5 Vzhled

- Čistý, vzdušný design. Systémové písmo (`system-ui`).
- CSS proměnné na `:root` pro barvy. Podpora tmavého režimu přes `prefers-color-scheme`.
- Barvy stavů (vždy doplněné textem):
  - `probiha` zelená,
  - `brzy` oranžová,
  - `prubezne` modrá,
  - `planovano` a `neznamy` šedá,
  - `ukonceno` šedá s přeškrtnutým nebo tlumeným zobrazením.
- Mobil: filtry nad výsledky, sbalitelné (`<details>`). Desktop (≥ 900 px): filtry v levém sloupci, karty v mřížce `repeat(auto-fill, minmax(300px, 1fr))`.
- Žádné vodorovné posouvání při šířce 360 px.

---

## 6. Úkoly v pořadí

### Úkol 1: Inicializace repozitáře

**Kroky:**

1. Vytvoř strukturu složek dle sekce 3.
2. `package.json` s `"type": "module"` a těmito skripty:
   - `"dev": "npx --yes http-server site -p 8080 -c-1"` (případně `npx serve site`),
   - `"validate": "node scripts/validate.mjs"`,
   - `"test": "node --test tests/"`.
3. `devDependencies`: `ajv`, `ajv-formats`.
4. `.gitignore`, `LICENSE` (MIT) a základní `README.md` (co to je, `npm install`, `npm run dev`, `npm run validate`, jak přidat aktivitu).
5. `git init` a první commit.

**Kritéria přijetí:**

- [ ] `npm install` proběhne bez chyb.
- [ ] `npm run dev` servíruje `site/` na `http://localhost:8080`.

> Poznámka: stránku nelze otevřít přes `file://`, protože `fetch` JSON tam nefunguje. Vždy používej lokální server.

### Úkol 2: JSON schémata

**Kroky:**

1. `schema/organizace.schema.json` a `schema/aktivity.schema.json` (JSON Schema draft 2020-12) přesně dle sekce 4.
2. Na objektech `additionalProperties: false`, aby se odhalily překlepy v názvech polí.
3. `format: "uri"` pro URL a `format: "date"` pro data.

**Kritéria přijetí:**

- [ ] Ukázkové objekty ze sekce 4 schématem projdou.
- [ ] Objekt s překlepem v názvu pole (např. `vek_odd`) neprojde.

### Úkol 3: Soupis zdrojů a sběr dat

**Kroky:**

1. Od uživatele získej město a seznam organizací a webů. Pokud ho nemá, navrhni seznam 10–15 kandidátů (ZUŠ, DDM/SVČ, největší sportovní kluby, skauti, Sokol, knihovna) a nech si ho potvrdit.
2. Zapiš je do `data-src/zdroje.md` jako tabulku `id | název | typ | web | stránka s kroužky | stránka s přihláškami | poznámka`.
3. Pro každou organizaci projdi její web, zjisti údaje a vyplň `organizace.json` a `aktivity.json`. Cíl: **5–10 organizací, celkem alespoň 20 aktivit.**
4. Pravidla sběru:
   - Každý údaj musí být dohledatelný na `zdroj_url`. Nic nevymýšlej ani neodhaduj.
   - Popisy piš vlastními slovy, krátce. Nekopíruj odstavce.
   - Neuváděj jména, osobní e-maily ani telefony konkrétních osob. Používej jen obecné kontakty organizace.
   - U ZUŠ je typicky přijímací řízení na jaře (přihlášky a talentové zkoušky). U sportovních klubů je často průběžný nábor nebo nábor v září. **Vždy ověř ve zdroji**, tyto typické vzory nepoužívej jako náhradu dat.
   - Pokud web uvádí termíny loňského roku, zapiš to do `prihlaska.poznamka` a data `od`/`do` nevyplňuj.
   - Nejasnosti zapisuj do sloupce poznámka v `zdroje.md`.
5. Doplň `meta.json`.

**Kritéria přijetí:**

- [ ] `npm run validate` projde.
- [ ] Každá aktivita má `zdroj_url` a `overeno`.
- [ ] Alespoň polovina aktivit má vyplněný věk a `prihlaska.zpusob`, který není obecný.

### Úkol 4: Validační skript a CI

**Kroky:**

1. `scripts/validate.mjs` kontroluje:
   - shodu se schématy (ajv + ajv-formats),
   - unikátnost `id` v obou souborech,
   - že každé `organizace_id` v aktivitách existuje,
   - `vek_od ≤ vek_do` a `prihlaska.od ≤ prihlaska.do`,
   - že `overeno` není v budoucnosti,
   - shodu číselníku kategorií ve schématu a v `site/js/data.js` (načti JS modul přes dynamický `import()`),
   - varování (ne chybu), pokud je `overeno` starší než 90 dní.
2. Výstup: srozumitelné chyby s cestou (např. `aktivity[3].prihlaska.do: ...`). Při chybě exit kód 1.
3. `.github/workflows/validate.yml`: spouští se na `push` a `pull_request`, používá Node LTS, `npm ci` a `npm run validate` a `npm test`.

**Kritéria přijetí:**

- [ ] Úmyslně rozbitá data (neexistující `organizace_id`) způsobí selhání skriptu s jasnou hláškou.
- [ ] Workflow v GitHub Actions je zelený.

### Úkol 5: Logika (čisté funkce) a testy

**Kroky:**

1. `site/js/filters.js`:
   - `normalizuj(text)`: malá písmena, odstranění diakritiky (`normalize('NFD').replace(/\p{Diacritic}/gu, '')`),
   - `filtruj(aktivity, filtry, kontext) → aktivity[]`,
   - `seradi(aktivity, dnes) → aktivity[]`.
2. `site/js/registration.js`: `stavPrihlasky()` dle 5.2 a `formatDatum()` ve formátu `d. m. rrrr`.
3. `site/js/url-state.js`: `filtryZUrl(search)` a `filtryDoUrl(filtry)`.
4. Testy v `tests/*.test.mjs` přes vestavěný `node:test` (bez další závislosti). Moduly ve `site/js` nesmí na úrovni modulu sahat na `document`/`window`, aby šly importovat v Node.
5. Minimální sada testů:
   - všechny větve `stavPrihlasky` včetně hraničních dnů (`dnes === od`, `dnes === do`) a kombinace ukončeno + průběžně,
   - filtr věku s chybějícími hranicemi,
   - vyhledávání bez diakritiky („klavir“ najde „klavír“, „TANEC“ najde „tanec“),
   - kombinace filtrů (AND mezi skupinami, OR v kategoriích),
   - převod URL tam a zpět.

**Kritéria přijetí:**

- [ ] `npm test` projde. Testy pokrývají všechny řádky tabulky v 5.2.

### Úkol 6: UI – HTML, CSS, vykreslování

**Kroky:**

1. `index.html`: sémantická kostra (`header`, `main`, `aside` pro filtry, `section` pro výsledky, `footer`), `lang="cs"`, meta viewport, popisek (`<meta name="description">`), Open Graph titulek a popis.
2. `css/style.css` dle 5.5.
3. `js/data.js`: `fetch` všech tří JSON souborů paralelně, spojení aktivit s organizacemi (mapa podle `id`) a číselník kategorií.
4. `js/render.js`: vykreslení karet. **Texty z dat vkládej přes `textContent` nebo bezpečné escapování, nikdy přes `innerHTML` s neošetřenými daty.** Externí odkazy mají `rel="noopener"` a `target="_blank"`.
5. `js/app.js`: inicializace, napojení událostí, obnovení filtrů z URL, překreslení při změně.
6. `o-projektu.html` dle 5.4.

**Kritéria přijetí:**

- [ ] Všechny filtry z 5.1 fungují a kombinují se správně.
- [ ] Obnovení stránky s parametry v URL zachová filtry.
- [ ] Bez chyb v konzoli prohlížeče.
- [ ] Při 360 px šířce není vodorovný posuvník. Filtry jsou na mobilu sbalitelné.
- [ ] Celá stránka je ovladatelná klávesnicí a viditelný je focus.
- [ ] Lighthouse (mobil): Accessibility ≥ 95, Performance ≥ 90, Best Practices ≥ 95.
- [ ] Prázdný, chybový i načítací stav fungují. Chybový stav ověříš dočasným přejmenováním `aktivity.json`.

### Úkol 7: Nasazení na GitHub Pages

**Kroky:**

1. Vytvoř veřejný repozitář `{GITHUB_USER}/{REPO}` a pushni.
2. `.github/workflows/deploy.yml`: při push do `main` nejdřív spustí validaci, pak nahraje složku `site/` přes `actions/upload-pages-artifact` a nasadí přes `actions/deploy-pages`. Potřebná oprávnění: `pages: write`, `id-token: write`.
3. V nastavení repozitáře: Settings → Pages → Source: **GitHub Actions**. Tento krok musí udělat uživatel ručně. Pokud k tomu agent nemá přístup, sdělí mu přesný postup.
4. Ověř, že všechny cesty v HTML jsou **relativní** (`css/style.css`, ne `/css/style.css`), protože web poběží na `https://{GITHUB_USER}.github.io/{REPO}/`.

**Kritéria přijetí:**

- [ ] Web je dostupný na `https://{GITHUB_USER}.github.io/{REPO}/`.
- [ ] Nevalidní data zastaví nasazení.

### Úkol 8: Ověření s uživateli a předání

**Kroky:**

1. Projdi stránku proti kontrolnímu seznamu v sekci 7.
2. Připrav pro uživatele krátký text, který může poslat 3–5 rodičům, a 3 otázky na zpětnou vazbu:
   - „Našli jste, co jste hledali?“
   - „Co vám chybělo?“
   - „Použili byste to znovu nebo to doporučili?“
3. Aktualizuj `README.md`: jak přidat nebo upravit aktivitu (krok za krokem pro netechnického člověka přes webové rozhraní GitHubu) a jak spustit validaci.
4. Sepiš do `data-src/zdroje.md` sekci „Zjištění pro fázi 3–4“: které weby jsou dobře strukturované, které ne, kde jsou data v PDF či obrázcích a kde chybí termíny přihlášek.

**Kritéria přijetí:**

- [ ] README umožní cizímu člověku přidat aktivitu bez znalosti programování.
- [ ] Zjištění pro další fáze jsou zapsaná.

---

## 7. Kontrolní seznam před dokončením fáze 1

- [ ] Data: 5–10 organizací, alespoň 20 aktivit, vše se `zdroj_url` a `overeno`, žádné vymyšlené údaje.
- [ ] Žádné osobní údaje konkrétních osob.
- [ ] `npm run validate` a `npm test` procházejí lokálně i v CI.
- [ ] Web je nasazený a funguje na mobilu i desktopu.
- [ ] Stav přihlášek se počítá správně k dnešnímu datu.
- [ ] Filtry jsou sdílitelné přes URL.
- [ ] Upozornění „ověřujte u pořadatele“ a datum aktualizace jsou viditelné.
- [ ] Stránka „O projektu“ s výčtem zdrojů a kontaktem pro opravy existuje.
- [ ] README je aktuální.

---

## 8. Co dělat, když…

| Situace | Postup |
|---|---|
| Web organizace nemá informace o přihláškách | `prihlaska.zpusob = "Informace na webu organizace."`, `odkaz` = hlavní stránka. Poznamenej v `zdroje.md`. |
| Informace jsou jen v PDF nebo na obrázku | Údaje opiš ručně, `zdroj_url` = URL PDF. Zapiš do zjištění pro fázi 3. |
| Informace jen na Facebooku či Instagramu | Lze použít, `zdroj_url` = URL příspěvku nebo stránky. Označ v poznámce. |
| Rozpor mezi dvěma stránkami téhož webu | Použij novější nebo konkrétnější údaj, rozpor zapiš do `prihlaska.poznamka`. |
| Jedna aktivita pro více věkových skupin s různou cenou | Rozděl na více aktivit (např. `-pripravka`, `-starsi-zaci`). |
| Nejasnost v zadání | Zeptej se uživatele. Nerozhoduj zásadní věci sám. |

---

## 9. Navazující fáze (mimo rozsah, jen pro orientaci)

- **Fáze 2:** mapa (Leaflet + OSM, využije `misto.gps`), detail aktivity, filtr dne v týdnu, export do .ics.
- **Fáze 3:** skript pro monitoring změn zdrojů (hash obsahu), denní cron v GitHub Actions a issue při změně.
- **Fáze 4:** AI extrakce změněných stránek (Claude API) do JSON, validace a pull request ke schválení.

Návrh ve fázi 1 to má umožnit: datové soubory jsou oddělené, schéma je přísné a logika je v čistých funkcích.

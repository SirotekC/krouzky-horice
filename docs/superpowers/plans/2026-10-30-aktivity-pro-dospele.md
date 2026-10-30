# Aktivity pro dospělé – implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat na web samostatnou sekci „Pro dospělé“ (cvičení, tance, kurzy) s vlastními daty, filtry a vzhledem, sdílející kód, organizace a monitoring s dětskou částí.

**Architecture:** Dvě stránky nad stejnými JS moduly: `index.html` (děti, beze změny URL kvůli QR kódům) a `dospeli.html`. Stránka určuje sekci atributem `<body data-sekce="…">`, `site/js/sekce.js` podle něj vrací konfiguraci (cesta k datům, číselník kategorií a skupin, texty). Data dospělých jsou v `site/data/dospeli/aktivity.json` s vlastním schématem. Společné části schématu jsou ve `schema/spolecne.schema.json`. `organizace.json`, `meta.json` a `kontrola.json` zůstávají společné. Aktivita žije v jedné sekci, příznakem `i_pro_dospele` / `i_pro_deti` se zobrazí i v té druhé.

**Tech Stack:** Statický web (ES moduly bez buildu), JSON Schema 2020-12 + Ajv, `node:test`, GitHub Pages.

**Spec:** Tento dokument (sekce „Rozhodnutí“). Návrh vznikl v konverzaci 2026-10-30, samostatný spec neexistuje.

## Rozhodnutí (spec)

- Sekce pro dospělé je oddělená vizuálně i datově, ne jen filtrem. Přepínač **Děti | Dospělí** v hlavičce jako dvě záložky (odkazy na `./` a `dospeli.html`).
- Značka a název **„Kroužky Hořice“ zůstávají**. Sekce se jmenuje „Pro dospělé“.
- Soukromí lektoři (OSVČ) se zatím **nepřidávají**. Jen organizace a subjekty s vlastním webem, kontakt = odkaz na web. Pravidlo „žádné osobní kontakty“ platí beze změny.
- Hraniční aktivity: záznam je v jedné sekci, `i_pro_dospele: true` (u dětí) / `i_pro_deti: true` (u dospělých) ho zobrazí i v druhé sekci se štítkem „Z nabídky pro děti“ / „Z nabídky pro dospělé“. Aktivity „rodiče s dětmi“ patří k dětem.
- Dětská data **zůstávají** v `site/data/aktivity.json` (nepřesouvat, aby merge z `main` nekolidoval).
- Vývoj ve větvi `dospeli`. **Nezveřejňuje se**, dokud to uživatel neřekne. Opravy dětských kroužků jdou dál do `main` a průběžně se mergují do `dospeli`.

## Global Constraints

- Kód, identifikátory, komentáře a texty česky, styl jako stávající `site/js/*.js` (JSDoc nad exporty, čisté funkce bez DOM v `filters.js`, `url-state.js`, `data.js`).
- Žádný build, žádné nové závislosti.
- **Dětský web se nesmí změnit:** stejné URL, stejné parametry filtrů v URL, stejné texty. Všechny stávající testy procházejí beze změny očekávaných hodnot (mění se jen importy, pokud je to nutné).
- Id aktivit jsou **unikátní napříč oběma soubory** (detail `#/aktivita/{id}` musí být jednoznačný).
- Každá kategorie aktivity s `i_pro_dospele` musí existovat v číselníku dospělých a naopak (validace).
- Kontrast textu akcentu sekce dospělých vůči pozadí ≥ 4,5 : 1 ve světlém i tmavém režimu.
- Před každým commitem `npm run validate` a `npm test` musí projít. Commity do větve `dospeli`, **nepushovat do `main`**.

## Review Focus

1. **Stará dětská URL s filtry** (`?skup=sport&kat=plavani&vek=8`) musí po refaktoringu dát stejný výsledek. → test v úkolu 3 (stávající `url-state.test.mjs` beze změny očekávání).
2. **Dětská aktivita s `i_pro_dospele` zobrazená u dospělých**: filtr zaměření dospělých ji musí najít podle jejích kategorií a karta nesmí ukázat prázdné údaje. → test v úkolu 3 (filtr) a v úkolu 2 (validace kategorií).
3. **Aktivita bez rozvrhu** (jen `terminy.text`) a filtr denní doby: musí projít každou dobou, stejně jako aktivita bez dnů projde filtrem dnů. → test v úkolu 3.
4. **Čas přes hranici doby** (`11:30–13:00`): rozhoduje začátek, tj. „dopoledne“. → test v úkolu 3.
5. **Chybějící `dospeli/aktivity.json`** (např. při merge nebo chybě nasazení): dětská stránka se musí načíst i bez něj. → test v úkolu 4.

---

## Struktura souborů

| Soubor | Odpovědnost |
|---|---|
| `schema/spolecne.schema.json` | Nové. Sdílené `$defs`: `den`, `misto`, `terminy`, `cena`, `prihlaska`, `klicova_slova`, `zdroj` |
| `schema/aktivity.schema.json` | Dětské aktivity, odkazuje na společné `$defs`, nově `i_pro_dospele` |
| `schema/aktivity-dospeli.schema.json` | Nové. Aktivity pro dospělé |
| `scripts/validate.mjs` | Validace obou sekcí + kontroly napříč sekcemi |
| `site/js/data.js` | Číselníky obou sekcí, `nactiData(sekce)` |
| `site/js/sekce.js` | Nové. Konfigurace sekcí a `aktualniSekce()` |
| `site/js/filters.js` | Skupiny z kontextu, nové filtry `doba`, `uroven`, `vstup` |
| `site/js/url-state.js` | Skupiny z parametru, nové parametry |
| `site/js/render.js` | Nové údaje na kartě, štítek druhé sekce, texty podle sekce |
| `site/js/app.js` | Spuštění podle sekce, formulář dospělých |
| `site/dospeli.html` | Nové. Stránka sekce |
| `site/index.html`, `site/o-projektu.html` | Přepínač sekcí |
| `site/css/style.css` | Přepínač, akcent sekce dospělých |
| `scripts/monitor.mjs` | Sledovat i URL z dat dospělých |
| `site/data/dospeli/aktivity.json` | Nové. Pilotní data |
| `data-src/zdroje.md`, `CLAUDE.md` | Zdroje a pravidla pro dospělé |

### Formát aktivity pro dospělé (sdílený všemi úkoly)

Shodná pole s dětmi: `id`, `organizace_id`, `nazev`, `kategorie`, `popis`, `misto`, `terminy`, `cena`, `prihlaska`, `klicova_slova`, `zdroj_url`, `overeno` (stejná pravidla jako v `CLAUDE.md`). Rozdíly:

```json
{
  "id": "ddm-horice-latina-pro-zeny",
  "kategorie": ["tanec"],
  "vek_od": 15,
  "uroven": "zacatecnici",
  "urceno_pro": ["zeny"],
  "prihlaska": { "typ": "prihlaska", "zpusob": "…", "prubezne": false, "od": null, "do": null, "odkaz": "…" },
  "i_pro_deti": false
}
```

- Chybí `vek_do`, `pohlavi`, `skolni_rok`. `vek_od` je volitelný (jen když zdroj uvádí minimální věk).
- `uroven`: `zacatecnici` | `pokrocili` | `vsichni` | `null`.
- `urceno_pro`: pole z `zeny`, `muzi`, `seniori`, `tehotne`. Prázdné nebo chybí = pro všechny.
- `prihlaska.typ` (**povinné**): `bez-prihlasky` | `rezervace` | `prihlaska`.
- `cena.obdobi` (společné pro obě sekce) rozšířeno o `permanentka` a `kurz`.

Číselník kategorií dospělých (klíč → popisek), skupiny:

| Skupina (`klic`: popisek) | Kategorie |
|---|---|
| `pohyb`: Pohyb | `cviceni`: Cvičení a fitness, `joga`: Jóga, pilates a relaxace, `tanec`: Tanec, `sport-mickove`: Míčové sporty, `sport-ostatni`: Ostatní sporty |
| `kultura`: Kultura a tvoření | `hudba`: Hudba a zpěv, `vytvarne`: Výtvarné a rukodělné, `divadlo`: Divadlo a literatura |
| `vzdelavani`: Vzdělávání | `jazyky`: Jazyky, `vzdelavani`: Přednášky a kurzy |
| `priroda`: Příroda a turistika | `priroda`: Příroda a turistika |
| `ostatni`: Ostatní | `ostatni`: Ostatní |

Klíče sdílené s dětmi (`tanec`, `sport-*`, `hudba`, `vytvarne`, `divadlo`, `jazyky`, `priroda`, `ostatni`) mají stejný význam. Díky tomu se dětská aktivita s `i_pro_dospele` zařadí i do filtru dospělých.

---

### Úkol 1: Větev a společné schéma

**Files:**
- Create: `schema/spolecne.schema.json`
- Modify: `schema/aktivity.schema.json`, `scripts/validate.mjs` (`vytvorValidatory`)
- Test: `tests/schema.test.mjs`

**Interfaces:**
- Produces: `schema/spolecne.schema.json` s `$id` `https://krouzky.example/schema/spolecne.schema.json` a `$defs` `den`, `misto`, `terminy`, `cena`, `prihlaska`, `klicova_slova`. Odkazuje se na ně `{"$ref": "spolecne.schema.json#/$defs/…"}`. `vytvorValidatory()` přidá schéma přes `ajv.addSchema` před kompilací.

- [ ] **Step 1: Vytvoř větev** `git switch -c dospeli` z aktuálního `main` (případně worktree podle `superpowers:using-git-worktrees` v `.claude/worktrees/dospeli`).
- [ ] **Step 2: Přidej testy** do `tests/schema.test.mjs`:
  - `cena.obdobi 'permanentka' a 'kurz' jsou platné` → `validatory.aktivity([{ ...ukazkaAktivity, cena: { text: null, castka_kc: 1200, obdobi: 'permanentka' } }])` je `true`.
  - `i_pro_dospele je volitelný boolean` → s `i_pro_dospele: true` platné, s `'ano'` neplatné.
- [ ] **Step 3: Spusť** `node --test tests/schema.test.mjs`. Očekávané: FAIL u obou nových testů.
- [ ] **Step 4: Přesuň** definice `misto`, `terminy`, `cena`, `prihlaska`, `klicova_slova`, `den` do `spolecne.schema.json` beze změny obsahu, jen přidej `"permanentka", "kurz"` do enumu `cena.obdobi`. V `aktivity.schema.json` je nahraď `$ref` a přidej `"i_pro_dospele": { "type": "boolean" }`.
- [ ] **Step 5: Spusť** `npm test && npm run validate`. Očekávané: vše PASS, `✔ Data jsou v pořádku.`
- [ ] **Step 6: Commit** `Společné části schématu aktivit, nové typy ceny a příznak i_pro_dospele`.

### Úkol 2: Schéma a validace dat pro dospělé

**Files:**
- Create: `schema/aktivity-dospeli.schema.json`, `site/data/dospeli/aktivity.json` (zatím `[]`)
- Modify: `site/js/data.js` (číselníky), `scripts/validate.mjs`
- Test: `tests/schema.test.mjs`, `tests/validate.test.mjs`

**Interfaces:**
- Consumes: `spolecne.schema.json` (úkol 1).
- Produces v `site/js/data.js`: `KATEGORIE_DOSPELI`, `SKUPINY_KATEGORII_DOSPELI` (podle tabulky výše), `UROVNE = { zacatecnici: 'Začátečníci', pokrocili: 'Pokročilí', vsichni: 'Všechny úrovně' }`, `URCENO_PRO = { zeny: 'Ženy', muzi: 'Muži', seniori: 'Senioři', tehotne: 'Těhotné' }`, `TYPY_VSTUPU = { 'bez-prihlasky': 'Bez přihlášky', rezervace: 'Rezervace předem', prihlaska: 'Přihláška na kurz' }`.
- Produces v `scripts/validate.mjs`: `vytvorValidatory()` vrací navíc `aktivityDospeli` a `schemaAktivityDospeli`. `zkontrolujData` dostane nepovinné `aktivityDospeli = []`, `kategorieSchemaDospeli`, `kategorieUiDospeli`, `skupinyUiDospeli` a kontroluje je stejně jako dětské (cesty v hláškách `dospeli[i]…`).

- [ ] **Step 1: Testy schématu**: ukázková aktivita dospělých (podle formátu výše) je platná. Chybějící `prihlaska.typ` → chyba `required`. `vek_do` → `additionalProperties`. `urceno_pro: ['deti']` → `enum`.
- [ ] **Step 2: Testy `zkontrolujData`** v `tests/validate.test.mjs`:
  - `duplicitní id napříč sekcemi` → chyba obsahuje `duplicitní id „x“` a `dospeli[0]`.
  - `i_pro_dospele s kategorií, kterou dospělí nemají` (dětská `kategorie: ['bojove']`) → chyba `aktivity[0].kategorie: „bojove“ není v číselníku dospělých (i_pro_dospele)`.
  - `i_pro_deti s kategorií 'joga'` → obdobná chyba `není v číselníku dětí (i_pro_deti)`.
  - `kategorie dospělých: schéma vs. UI` → stejné hlášky jako u dětí s předponou `kategorie dospělých:`.
  - `organizace_id dospělé aktivity musí existovat`.
- [ ] **Step 3: Spusť** `npm test`. Očekávané: nové testy FAIL.
- [ ] **Step 4: Implementuj** schéma, číselníky a rozšíření `zkontrolujData` / `validuj` (načítá `site/data/dospeli/aktivity.json`). Kontrola `kontrola.url` bere zdroje z obou sekcí.
- [ ] **Step 5: Spusť** `npm test && npm run validate`. Očekávané: PASS.
- [ ] **Step 6: Commit** `Schéma a validace aktivit pro dospělé`.

### Úkol 3: Filtry a URL podle sekce

**Files:**
- Modify: `site/js/filters.js`, `site/js/url-state.js`
- Test: `tests/filters.test.mjs`, `tests/url-state.test.mjs`

**Interfaces:**
- Consumes: `SKUPINY_KATEGORII_DOSPELI`, `UROVNE`, `TYPY_VSTUPU` (úkol 2).
- Produces:
  - `prazdneFiltry()` → navíc `doba: [], uroven: '', vstup: ''`.
  - `DOBY_FILTRU = { rano: 'Ráno (do 9)', dopoledne: 'Dopoledne', odpoledne: 'Odpoledne', vecer: 'Večer (od 17)' }`.
  - `dobaZCasu(cas: string): string | null`. Rozhoduje **začátek** intervalu: `< 9:00` rano, `< 12:00` dopoledne, `< 17:00` odpoledne, jinak vecer. Neplatný text → `null`.
  - `filtruj(aktivity, filtry, kontext)`: `kontext.skupiny` (výchozí `SKUPINY_KATEGORII`) nahrazuje přímé použití v `hledaneKategorie` a `textProHledani`. Nové podmínky (AND s ostatními): `doba` (OR mezi dobami, aktivita bez `rozvrh` s časy projde vždy), `uroven` (aktivita s `uroven` `vsichni` nebo bez úrovně projde vždy), `vstup` (rovnost s `prihlaska.typ`).
  - `jsouPrazdne` bere v úvahu nová pole.
  - `filtryZUrl(search, platneOrganizace = null, skupiny = SKUPINY_KATEGORII)` a `filtryDoUrl(filtry)` s novými parametry `doba=rano,vecer`, `uroven=…`, `vstup=…` v tomto pořadí za `pohlavi`.

- [ ] **Step 1: Testy** (`filters.test.mjs`):
  - `dobaZCasu: hranice` → `'8:59–10:00'` rano, `'9:00–10:00'` dopoledne, `'11:30–13:00'` dopoledne, `'12:00–13:00'` odpoledne, `'17:00–18:00'` vecer, `'x'` null.
  - `filtr doby: OR mezi dobami, aktivita bez rozvrhu projde`.
  - `filtr úrovně: vsichni a bez úrovně projdou`.
  - `filtr vstupu podle prihlaska.typ`.
  - `skupiny z kontextu: skup ['pohyb'] najde tanec i cviceni` s `kontext.skupiny = SKUPINY_KATEGORII_DOSPELI`.
- [ ] **Step 2: Testy** (`url-state.test.mjs`): převod tam a zpět s `doba`, `uroven`, `vstup` a skupinami dospělých. Neplatná `doba=noc` a `uroven=mistr` se ignorují. **Stávající testy beze změny očekávaných hodnot**, jen ve výsledných objektech přibudou prázdná nová pole.
- [ ] **Step 3: Spusť** `npm test`. Očekávané: nové testy FAIL.
- [ ] **Step 4: Implementuj** podle Interfaces.
- [ ] **Step 5: Spusť** `npm test`. Očekávané: PASS.
- [ ] **Step 6: Commit** `Filtry denní doby, úrovně a vstupu; skupiny kategorií podle sekce`.

### Úkol 4: Konfigurace sekcí a načítání dat

**Files:**
- Create: `site/js/sekce.js`
- Modify: `site/js/data.js` (`nactiData`, `pripravData`, `statistiky`)
- Test: `tests/sekce.test.mjs` (nový), `tests/data-nacteni.test.mjs`

**Interfaces:**
- Produces v `sekce.js`: `SEKCE.deti` a `SEKCE.dospeli`, každá `{ klic, soubor, druhaSekce, priznakZDruhe, kategorie, skupiny, tvary, odkazZpet, stitekZDruhe }`:
  - deti: `soubor: 'aktivity.json'`, `druhaSekce: 'dospeli'`, `priznakZDruhe: 'i_pro_deti'`, `tvary: ['kroužek', 'kroužky', 'kroužků']`, `odkazZpet: '← Všechny kroužky'`, `stitekZDruhe: 'Z nabídky pro dospělé'`.
  - dospeli: `soubor: 'dospeli/aktivity.json'`, `druhaSekce: 'deti'`, `priznakZDruhe: 'i_pro_dospele'`, `tvary: ['aktivita', 'aktivity', 'aktivit']`, `odkazZpet: '← Všechny aktivity'`, `stitekZDruhe: 'Z nabídky pro děti'`.
  - `aktualniSekce(dataset: DOMStringMap | undefined): Sekce`. Neznámá nebo chybějící hodnota → `SEKCE.deti`.
- Produces v `data.js`: `nactiData(zaklad = 'data/', sekce = null, druha = null)`. `sekce` a `druha` jsou objekty z `SEKCE`, předává je `app.js`. Vlastní soubor (`sekce.soubor`) se načte povinně, soubor druhé sekce **nepovinně** (chyba → `[]`). Každá aktivita dostane `sekce: 'deti' | 'dospeli'`. Z druhé sekce se přidají jen ty s `sekce.priznakZDruhe === true`. Při `sekce === null` se chová jako dnes (jen `aktivity.json`), takže stávající test projde beze změny. `statistiky` beze změny.
- `data.js` **neimportuje** `sekce.js` (`sekce.js` importuje číselníky z `data.js`, cyklus by při načtení spadl na TDZ).

- [ ] **Step 1: Testy**: `aktualniSekce({ sekce: 'dospeli' })` → `SEKCE.dospeli`, `aktualniSekce({})` a `aktualniSekce({ sekce: 'x' })` → `SEKCE.deti`. `nactiData('data/', SEKCE.deti, SEKCE.dospeli)` s mockovaným `fetch` jako ve stávajícím testu `nactiData: chybějící kontrola.json`. Mock ale musí rozlišovat **celou cestu**, protože `dospeli/aktivity.json` i `aktivity.json` končí stejně. Dospělá aktivita s `i_pro_deti: true` je ve výsledku se `sekce: 'dospeli'`, bez příznaku tam není. **Chybějící `dospeli/aktivity.json` → dětská data se načtou**.
- [ ] **Step 2: Spusť** `npm test`. Očekávané: FAIL.
- [ ] **Step 3: Implementuj** podle Interfaces.
- [ ] **Step 4: Spusť** `npm test`. Očekávané: PASS.
- [ ] **Step 5: Commit** `Konfigurace sekcí a načítání aktivit z obou sekcí`.

### Úkol 5: Karta a texty podle sekce

**Files:**
- Modify: `site/js/render.js`
- Test: ruční kontrola (render pracuje s DOM, v repu pro něj testy nejsou); čisté pomocné funkce otestuj v `tests/souhrn-terminu.test.mjs`

**Interfaces:**
- Consumes: `UROVNE`, `URCENO_PRO`, `TYPY_VSTUPU`, `Sekce` (úkoly 2 a 4).
- Produces:
  - `textUrcenoPro(urcenoPro: string[] | undefined): string | null` → `'Ženy, senioři'` (první popisek s velkým písmenem, další malým). Prázdné → `null`.
  - `kartaAktivity(a, dnes, { …, sekce })` přidá řádky `Úroveň`, `Pro` (u dospělých z `urceno_pro`, u dětí dál z `pohlavi`) a `Vstup`. Do hlavičky karty přidá štítek `sekce.stitekZDruhe`, když `a.sekce !== sekce.klic`. Věk se zobrazí jen, když je vyplněný (beze změny chování `textVeku`).
  - `seznamKaret(aktivity, dnes, rozbalene, kontrola, sekce)`, `detailAktivity(a, dnes, odkazZpet, kontrola, sekce)`, `pocetAktivit(n, tvary)` (nahrazuje volání `pocetKrouzku` v `app.js`, `pocetKrouzku` zůstane jako `pocetAktivit(n, SEKCE.deti.tvary)`), `radekStatistik(stat, tvary)`, `chybovyStav(tvary)` (text „Nepodařilo se načíst seznam {tvary[2]}.“).
  - U sbalené karty dospělých je ve viditelné části místo věku `Vstup`.

- [ ] **Step 1: Test** `textUrcenoPro(['zeny', 'seniori'])` → `'Ženy, senioři'`, `textUrcenoPro([])` → `null`.
- [ ] **Step 2: Spusť**. Očekávané: FAIL. **Step 3: Implementuj.** **Step 4: Spusť** `npm test`. Očekávané: PASS.
- [ ] **Step 5: Commit** `Údaje pro dospělé na kartě a texty podle sekce`.

### Úkol 6: Stránka pro dospělé, přepínač a vzhled

**Files:**
- Create: `site/dospeli.html`
- Modify: `site/index.html`, `site/o-projektu.html`, `site/js/app.js`, `site/css/style.css`

**Interfaces:**
- Consumes: vše z úkolů 3–5.
- `app.js`: `const sekce = aktualniSekce(document.body.dataset)`, data přes `nactiData('data/', sekce, SEKCE[sekce.druhaSekce])`. Formulář se plní podle prvků, které ve stránce jsou (`#f-vek`, `#f-pohlavi` jen u dětí, `#f-doba`, `#f-uroven`, `#f-vstup` jen u dospělých). `prectiFormular` / `zapisDoFormulare` chybějící prvky přeskočí. Do `filtruj` jde `kontext.skupiny = sekce.skupiny`, do `filtryZUrl` `sekce.skupiny`. Titulek detailu `{název} – Kroužky Hořice` beze změny.

Obsah `dospeli.html` (kopie `index.html` s rozdíly):
- `<body data-sekce="dospeli">`, `<title>Pro dospělé – Kroužky Hořice</title>`, meta description „Cvičení, tanec, jazyky a další pravidelné aktivity pro dospělé v Hořicích: kdy, kde, kolik stojí a jak se přihlásit.“
- Podtitul: „Aktivity pro dospělé v Hořicích přehledně“. Placeholder hledání: „např. jóga, zumba“.
- Filtry: Den v týdnu, Denní doba (`#f-doba`, chipy z `DOBY_FILTRU`), Zaměření, Úroveň (`#f-uroven`, select „Nezáleží“ + `UROVNE` bez `vsichni`), Vstup (`#f-vstup`, select „Nezáleží“ + `TYPY_VSTUPU`), Organizace, Stav přihlášek. Bez věku a pohlaví.
- Načítací text „Načítám aktivity…“.

Přepínač (ve všech třech stránkách, v `.hlavicka__obsah` pod značkou): `<nav class="sekce" aria-label="Sekce"><a href="./">Děti</a><a href="dospeli.html">Dospělí</a></nav>`, aktivní odkaz má `aria-current="page"` (na `o-projektu.html` žádný).

CSS:
- `.sekce`: dvě záložky jako segmentový přepínač (styl `.chip` / `chip--aktivni`), min. výška dotykové plochy 44 px.
- `body[data-sekce="dospeli"]`: světlý režim `--akcent: #7a4f33; --akcent-jemny: #f4e3d3;`, tmavý režim `--akcent: #d2a888; --akcent-text: #1f2e28; --akcent-jemny: #4a3020;`. Ověř kontrast (≥ 4,5 : 1).

- [ ] **Step 1: Implementuj** `app.js` a `dospeli.html`. Do `site/data/dospeli/aktivity.json` dočasně dej 2 ukázkové záznamy pro ruční test (v úkolu 7 je nahradí skutečná data).
- [ ] **Step 2: Ruční kontrola** přes `npm run dev`, na `http://localhost:8080/` i `/dospeli.html`, na šířce 375 px i 1280 px, ve světlém i tmavém režimu:
  - Dětská stránka vypadá a filtruje stejně jako na produkci. Porovnej `?skup=sport&vek=8` a `?dny=po&stav=probiha` s `https://krouzky.cendas.cz/`.
  - Na stránce pro dospělé fungují všechny filtry, URL se aktualizuje, detail `#/aktivita/{id}` i „← Všechny aktivity“ fungují.
  - Přepínač zvýrazní aktuální sekci a funguje z klávesnice.
  - Dětská aktivita s `i_pro_dospele` má u dospělých štítek „Z nabídky pro děti“.
- [ ] **Step 3: Spusť** `npm test && npm run validate`. Očekávané: PASS.
- [ ] **Step 4: Commit** `Stránka Pro dospělé a přepínač sekcí`.

### Úkol 7: Monitoring, pilotní data a dokumentace

**Files:**
- Modify: `scripts/monitor.mjs` (`nactiVstupy`), `site/data/dospeli/aktivity.json`, `site/data/organizace.json` (jen nové organizace), `site/data/aktivity.json` (příznaky `i_pro_dospele`), `data-src/zdroje.md`, `CLAUDE.md`, `site/o-projektu.html`
- Test: `tests/monitor-cli.test.mjs` nebo `tests/monitor-seznam-url.test.mjs`

**Interfaces:**
- `nactiVstupy(koren)` načte i `site/data/dospeli/aktivity.json` (chybějící soubor → `[]`) a do `sestavSeznamUrl` i `kapacitaDat` předá spojené pole. Ve workflow ani v `kontrola.json` se nic nemění.

- [ ] **Step 1: Test**: URL z dospělé aktivity je v seznamu sledovaných URL. **Step 2: Implementuj. Step 3:** `npm test`, očekávané PASS.
- [ ] **Step 4: Pilotní data**: 17 kurzů DDM pro dospělé vyřazených 2026-10-19 (seznam v `data-src/zdroje.md`, oddíl „Poznámky ze sběru (2026-10-19) – DDM po jednotlivých kroužcích“). Stránky `www.ddmhorice.cz/krouzky/{číslo}-{slug}`, postup podle `CLAUDE.md`. Na hraniční aktivity přidej `i_pro_dospele: true` jen tam, kde zdroj výslovně uvádí i dospělé (např. „pro děti i dospělé“, „od 14 let bez horní hranice“ samo nestačí).
- [ ] **Step 5: Dokumentace**: v `CLAUDE.md` přidej do tabulky „Kde jsou data“ `site/data/dospeli/aktivity.json` a oddíl „Aktivity pro dospělé“ (pole `uroven`, `urceno_pro`, `prihlaska.typ`, `i_pro_dospele` / `i_pro_deti`, lektoři OSVČ zatím ne, id unikátní napříč sekcemi). V `data-src/zdroje.md` přidej oddíl „Zdroje – dospělí“ (zatím DDM). Na `o-projektu.html` přidej jednu větu, že web nově obsahuje i aktivity pro dospělé, a odkaz na `dospeli.html`.
- [ ] **Step 6: Spusť** `npm test && npm run validate`. Očekávané: PASS. Uživateli vypiš rozpory mezi zdroji.
- [ ] **Step 7: Commit** `Pilotní aktivity pro dospělé (DDM), monitoring a dokumentace`.

## Průběžně a na konci

- Po každém commitu do `main` (opravy dětí): `git switch dospeli && git merge main`, vyřeš konflikty, `npm test && npm run validate`.
- **Zveřejnění jen na pokyn uživatele:** `git switch main && git merge dospeli`, `npm test && npm run validate`, `git push origin main`. Po nasazení ověř `https://krouzky.cendas.cz/` a `https://krouzky.cendas.cz/dospeli.html` (GitHub Pages obslouží i `/dospeli`).

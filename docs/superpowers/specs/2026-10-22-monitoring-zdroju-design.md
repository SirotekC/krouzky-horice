# Monitoring zdrojů: aktuálnost dat a nefunkční odkazy

Stav: návrh ke schválení (2026-10-22). Pokrývá fázi 3 z `PLAN.md` a kontrolu nefunkčních odkazů z fáze 5.

## 1. Proč

Data o kroužcích se dnes aktualizují ručně: agent projde všechny zdroje znovu. Nikdo neví, kdy se na webu organizace něco změnilo, a nefunkční odkaz se pozná, až když na něj klikne rodič. Cíl je, aby se správce **sám dozvěděl, kde se něco změnilo nebo rozbilo**, a ruční (agentem podporovanou) opravu dělal jen tam.

Postup správce:

1. Přijde e-mail se souhrnem kontroly.
2. Správce problém ověří.
3. Zadá agentovi „vyřeš issue #N“. Agent opraví data a issue zavře.

## 2. Cíle, ne-cíle, anti-cíle

**Cíle**
- Každé 3 dny automaticky zkontrolovat všechny zdroje a odkazy v datech.
- Po každé kontrole poslat **jeden** souhrnný e-mail, **i když se nic nezměnilo**.
- Nové problémy vypsat podrobně, přetrvávající jen v počtu.
- Weby organizací nezatěžovat.
- Fungovat **bez AI** a bez placených služeb.

**Ne-cíle**
- Automatická oprava dat ani AI extrakce (to je fáze 4, na tomto řešení nezávisí).
- Hlídání počtu volných míst (správce ho výslovně nechce řešit).
- Okamžité upozornění (stačí jednou za 3 dny).

**Anti-cíle (selhání, i kdyby to technicky fungovalo)**
- Zahlcování webů organizací (časté nebo souběžné požadavky, opakované stahování stejné URL).
- Falešné poplachy kvůli šumu (změna počtu volných míst, datum v patičce, banner). Kdyby správce dostával „změny“, které nic neznamenají, přestane e-maily číst.
- Opakované vypisování týchž problémů v každém e-mailu.
- Automatický zásah do údajů o kroužcích (`aktivity.json`, `organizace.json`). Monitoring smí v `main` měnit jen `site/data/kontrola.json` (viz 5.9).
- Text stránek (a s ním jména lidí) ve veřejném repozitáři nebo v issue.

## 3. Omezení

- Repozitář je **veřejný**. Issue, stavové soubory i tento dokument nesmí obsahovat osobní údaje (jména, osobní kontakty).
- Čistý Node.js (ES moduly), CI běží na `lts/*`, lokálně Node 18. Kód a komentáře česky, styl jako `scripts/validate.mjs`.
- Push do `main` spouští nasazení webu (`.github/workflows/deploy.yml`). Monitoring do `main` nesmí commitovat.
- GitHub Actions zdarma (veřejné repo). Žádné tajné klíče kromě automatického `GITHUB_TOKEN`.
- Pravidla šetrnosti z `PLAN.md`, kap. 7: `robots.txt`, zpoždění, identifikující User-Agent.

## 4. Rozhodnutí správce

- **Kanál:** GitHub issue. E-mail pošle GitHub sám, protože správce repozitář sleduje. Volitelně push přes aplikaci GitHub Mobile.
- **Rytmus:** každé 3 dny, v noci.
- **Jedno issue = jedna kontrola = jeden e-mail**, a to i bez nálezů.
- **V každém e-mailu jsou počty** změněných zdrojů a nefunkčních odkazů. Opakující se problémy se neposílají znovu podrobně.
- **Volná místa** se ignorují.
- **Bez AI:** deterministický skript.
- **Soukromí:** ukládají se jen otisky. Issue neobsahuje výřez rozdílu, jen URL a dotčené kroužky.
- **Jedno datum „Data načtena“** v zápatí i u kroužku. Posouvá ho kontrola beze změn i ruční aktualizace (5.9).
- **DDM:** kontrolují se detaily jednotlivých kroužků. Přehled kroužků se hlídá kvůli novým a zrušeným kroužkům.

## 5. Řešení

### 5.1 Části

| Část | Popis |
|---|---|
| `scripts/monitor.mjs` | Skript: sestaví seznam URL, stáhne je, porovná se stavem, vytvoří text souhrnu. Spustitelný lokálně (`npm run monitor`). |
| `data-src/monitor.json` | Nastavení: doplňkové URL (obrázky, PDF), pravidla čištění podle domény, výjimky. |
| `.github/workflows/monitor.yml` | Časovač (cron) + ruční spuštění. Spustí skript, uloží stav, založí issue. |
| `site/data/kontrola.json` | Data poslední úspěšné kontroly pro web (5.9). Jediný soubor, který monitoring mění v `main`. |
| větev `monitor-stav` | Stav mezi běhy: otisky, ETag/Last-Modified, seznam známých problémů. Mimo `main`, takže se nespouští nasazení. |

### 5.2 Seznam URL

Skript vezme z dat všechny unikátní URL (dnes asi 177):

- `aktivity.json`: `zdroj_url`, `prihlaska.odkaz`
- `organizace.json`: `web`, `zdroj_url`
- `monitor.json`: doplňkové URL zdrojů, které v datech nejsou. Jsou to hlavně obrázky a PDF s rozvrhy (Konvička, Turisťáček, ZUŠ Melodie, KLUHO) a stránky s kroužky ze `zdroje.md`, pokud chybí v datech.

URL se deduplikují. Každá se během jednoho běhu stáhne nejvýš jednou. U každé URL skript eviduje, kde je použitá (id aktivity nebo organizace a pole), aby to mohl vypsat v issue.

Dva druhy kontroly:

- **Obsah** (aktuálnost): pro URL ze `zdroj_url` a doplňkové URL. Stahuje se celý obsah.
- **Jen dostupnost:** pro ostatní (`prihlaska.odkaz`, `web`). Stačí `HEAD`, a když ho server nepodporuje (405/501), `GET` s ukončením po hlavičkách.

Pokud je URL v obou skupinách, provede se jen kontrola obsahu, která zároveň ověří dostupnost.

**Přehledové stránky (nové a zrušené kroužky).** Detaily kroužků nové kroužky neodhalí. Proto `monitor.json` obsahuje i přehledové stránky organizací (sloupec „stránka s kroužky“ ze `zdroje.md`).
- Kde má organizace pro každý kroužek vlastní detail (DDM: `/krouzky/{číslo}-{slug}`), sleduje se u přehledu **seznam odkazů na detaily** podle vzoru z `monitor.json`, ne text. Issue pak hlásí konkrétně „nový kroužek: URL“ nebo „kroužek zmizel z přehledu: URL“.
- Odkazy na detaily, které záměrně v datech nejsou (kroužky jen pro dospělé), se zapíšou do seznamu ignorovaných v `monitor.json`, aby se nehlásily stále dokola. Při řešení issue je tam doplní agent.
- U ostatních organizací se přehled hlídá stejně jako běžný zdroj (otisk textu). Nový kroužek se projeví jako změna stránky.
- Podobně se u přehledu DDM pozná i kroužek, který zmizel (zrušený), a to ještě dřív, než jeho detail začne vracet 404.

### 5.3 Šetrnost k webům

- Požadavky na **stejnou doménu jdou za sebou** s pauzou (výchozí 5 s, nastavitelná v `monitor.json`). Různé domény mohou běžet souběžně. DDM s asi 70 URL tak zabere zhruba 6 minut, což se do limitu Actions vejde.
- `robots.txt` se stáhne jednou na doménu a za běh. URL zakázané pro náš User-Agent nebo `*` se přeskočí a v souhrnu se uvedou jako „přeskočeno (robots.txt)“.
- User-Agent: `KrouzkyHorice-monitor/1.0 (+<URL stránky O projektu>)`.
- Podmíněné požadavky: `If-None-Match` / `If-Modified-Since` z minulého běhu. Odpověď `304` = beze změny, bez přenosu obsahu.
- Timeout 20 s na požadavek. Žádné okamžité opakování. Opakování řeší až další běh (viz 5.5).
- Přesměrování se následují (max. 5). Trvalé přesměrování na jinou URL se hlásí jako informace („odkaz přesměrován, zvážit aktualizaci“), ne jako chyba.

### 5.4 Detekce změn obsahu

1. **HTML:** převod na čistý text. Z DOMu se odstraní `script`, `style`, `nav`, `header`, `footer`, `form`. Když má doména v `monitor.json` selektor hlavního obsahu, vezme se jen ten. Bílé znaky se normalizují.
2. **Pravidla šumu podle domény** (`monitor.json`): regulární výrazy na řádky nebo úseky, které se před porovnáním odstraní. Pro DDM se odstraní **volná místa** (a případně počet přihlášených). Obecně se odstraňují datumy a časy vygenerování stránky, počítadla návštěv a podobně.
3. **Obrázky, PDF a jiné binární soubory:** porovnává se otisk bajtů.
4. Spočítá se SHA-256 a porovná s posledním **potvrzeným** otiskem.
5. **Ukládají se jen otisky, ne text stránek** (rozhodnutí správce kvůli soukromí: stránky mohou obsahovat jména vedoucích a repozitář je veřejný). Issue proto neobsahuje výřez rozdílu, jen URL a dotčené kroužky. Co se změnilo, zjistí agent při řešení otevřením stránky a porovnáním s daty.

Pravidla čištění se budou ladit podle prvních běhů. Úspěch = žádné falešné změny tři běhy po sobě u zdrojů, kde se nic nedělo.

### 5.5 Stav problémů a co je „nové“

Pro každou URL se eviduje:

- `potvrzeny_otisk`: otisk stavu, ze kterého vycházejí data.
- `posledni_otisk`, `etag`, `last_modified`, `posledni_kontrola`.
- `chyba`: druh chyby, kdy se poprvé objevila, počet běhů po sobě.

**Změněný zdroj**
- **Nový:** otisk se liší od potvrzeného a v minulém běhu se nelišil, nebo se od minulého běhu znovu změnil.
- **Přetrvávající:** liší se stejně jako v minulém běhu. Ještě nevyřešeno.
- **Vyřešený:** agent při opravě dat potvrdí nový otisk (viz 5.7).

**Nefunkční odkaz** (404, 410, 5xx, DNS chyba, timeout, chyba certifikátu)
- První selhání se **nehlásí** (dočasný výpadek). Hlásí se až **druhý běh po sobě**, tedy po 3 dnech. Tehdy je **nový**.
- Další běhy už jen **přetrvávající**.
- Jakmile odkaz funguje, problém zmizí sám. Pokud ho agent z dat odstraní, zmizí taky.
- `403` a `429` se hlásí odděleně jako „server odmítl kontrolu“, ne jako nefunkční odkaz (může jít o ochranu proti robotům).

**Výchozí stav a změny pravidel** (rozhodnutí agenta)
- **První běh** a každá **nově přidaná URL**: první otisk se automaticky uloží jako potvrzený, bez hlášení změny. V souhrnu se objeví jen počet „nově sledováno: N“.
- U každého otisku se ukládá **verze pravidel čištění** dané domény (otisk nastavení z `monitor.json` a verze skriptu). Když se pravidla změní, URL té domény se při dalším běhu automaticky přepočítají a uloží jako potvrzené (počet „přepočítáno po změně pravidel: N“). Změna pravidel tak nevyvolá vlnu falešných poplachů. Změna zdroje, ke které dojde právě v tom běhu, se přitom nepozná. To je přijatelné riziko.
- URL, která z dat zmizí, se ze stavu odstraní.

### 5.6 Issue a e-mail

Po každém běhu vznikne jedno issue se štítkem `monitoring`.

**Název:** `Kontrola zdrojů 2026-10-25: 2 nové změny, 1 nový nefunkční odkaz`, případně `Kontrola zdrojů 2026-10-25: bez nových problémů`.

**Tělo:**

```
Zkontrolováno 177 URL (z toho 160 beze změny přes 304).

| | nové | přetrvávající |
|---|---|---|
| Změněné zdroje | 2 | 1 |
| Nefunkční odkazy | 1 | 3 |
| Server odmítl kontrolu | 0 | 1 |
| Přeskočeno (robots.txt) | – | 0 |

## Nové změny zdrojů
- https://www.ddmhorice.cz/krouzky/1000-latino-kids – ddm-horice-latino-kids (zdroj_url)

## Nové a zrušené kroužky v přehledech
- nový: https://www.ddmhorice.cz/krouzky/1012-… (přehled DDM)

## Nové nefunkční odkazy
- https://… – 404 – ddm-horice-xyz (prihlaska.odkaz)

<details><summary>Přetrvávající problémy (4)</summary>
…seznam bez rozdílů…
</details>
```

- Když nejsou žádné **nové** problémy, issue se po založení **hned zavře**. E-mail přijde, ale v otevřených issues zůstanou jen ty, které je potřeba řešit.
- Starší otevřené issue se nezavírá automaticky. Zavře ho agent při řešení.
- Issue obsahuje jen URL, id kroužků a organizací a stavové kódy, žádný text ze stránek. Tím je vyloučeno, že by se do veřejného repozitáře dostala jména nebo kontakty.
- Tabulka počtů má navíc řádek „Nové / zrušené kroužky v přehledech“.

### 5.7 Řešení issue agentem

Pokyn „vyřeš issue #N“:

1. Agent přečte issue a dotčené stránky, opraví `aktivity.json` a `organizace.json` podle pravidel v `CLAUDE.md` (včetně `overeno`), spustí `npm run validate` a `npm test`.
2. Potvrdí nový stav: příkaz `npm run monitor -- --potvrdit <url…>` (nebo `--potvrdit-vse`) zapíše jako `potvrzeny_otisk` hodnotu `posledni_otisk` z posledního běhu, tedy stav, který issue hlásilo. Nic se znovu nestahuje. Pokud se stránka mezitím změnila znovu, zachytí to další běh. Skript si sám obstará větev `monitor-stav` (přes `git worktree` v dočasném adresáři), zapíše změnu, commitne a pushne. Když push selže kvůli souběžnému běhu workflow, udělá `pull --rebase` a zkusí to znovu (max. 3×). Stejně se chová i workflow. Stavový soubor je rozdělený po URL nebo seřazený, aby šly souběžné změny různých URL sloučit bez konfliktu.
3. Commit do `main` s textem `Closes #N`. Push zavře issue.

Postup se doplní do `CLAUDE.md` jako nová sekce.

### 5.8 GitHub Actions

`.github/workflows/monitor.yml`:

- `schedule`: `cron: '17 2 */3 * *'` (2:17 UTC každý 3. den v měsíci, mimo celou hodinu kvůli vytíženosti Actions). Na přelomu měsíce může být interval 1–2 dny, to nevadí.
- `workflow_dispatch` pro ruční spuštění.
- `permissions`: `contents: write` (jen kvůli větvi `monitor-stav`), `issues: write`.
- Kroky: checkout `main`, checkout `monitor-stav` do podadresáře, `npm ci`, `node scripts/monitor.mjs`, commit stavu do `monitor-stav`, `gh issue create` (případně `gh issue close`).
- `concurrency`, aby neběžely dva běhy najednou.
- Když skript sám spadne (chyba v kódu, ne nefunkční odkaz), workflow selže. GitHub pak pošle vlastní e-mail o selhání, takže o tom správce ví i bez issue.

Pozn.: GitHub vypíná plánované workflowy po 60 dnech bez aktivity v repozitáři. Commity do `monitor-stav` se podle dokumentace jako aktivita nepočítají spolehlivě. Pokud se to stane, GitHub pošle e-mail a workflow jde jedním kliknutím znovu zapnout.

### 5.9 Datum „Data načtena“ na webu

Rozhodnutí správce: na webu je **jedno datum**, „Data načtena“, v zápatí i u každého kroužku. Nahrazuje dnešní „Ověřeno …“ na kartě a „Data aktualizována …“ v zápatí.

- **U kroužku** = pozdější z dvou dat:
  - `overeno` (ruční aktualizace podle zdroje),
  - poslední kontrola, při které byl jeho `zdroj_url` beze změny, nebo změna byla vyřešená (potvrzená).
  Pokud má zdroj nevyřešenou změnu nebo je nefunkční, datum se neposouvá.
- **V zápatí** = pozdější z:
  - `meta.aktualizovano` (ruční aktualizace),
  - poslední kontrola, po které nezůstala **žádná** nevyřešená změna zdroje.
- Ruční aktualizace dat posune datum jako dnes (`overeno`, `meta.aktualizovano`).
- Varování „Údaje mohou být zastaralé“ (90 dní) se počítá od data „Data načtena“.
- Monitoring zapisuje data kontrol do samostatného souboru `site/data/kontrola.json` (`zdroj_url` → datum poslední úspěšné kontroly, a datum pro zápatí). `aktivity.json` ani `meta.json` nemění. Ruční a automatická data se tak nemíchají.
- Zápis `kontrola.json` je jediný commit monitoringu do `main`, jednou za běh. Spustí validaci a nasazení webu. Anti-cíl „nesahat do `main`“ se zužuje na „v `main` měnit jen `kontrola.json`“.
- Potvrzení otisku agentem (5.7) zapíše dotčeným URL do `kontrola.json` dnešní datum.
- Když `kontrola.json` chybí nebo URL v něm není, web použije jen `overeno` a `meta.aktualizovano`.
- `kontrola.json` potřebuje vlastní JSON Schema a kontrolu ve `validate.mjs`. Úprava frontendu (`render.js`, `app.js`) a testů je součástí práce.

### 5.10 Testy

`node --test` jako dosud. Testují se čisté funkce: sestavení seznamu URL z dat, čištění textu včetně pravidla pro volná místa v DDM, rozhodnutí nový/přetrvávající/vyřešený, sestavení textu issue. Bez síťových požadavků (fetch se mockuje).

## 6. Na builderovi

- Volba HTML parseru (např. `cheerio`, nebo `node-html-parser`) a knihovny na rozdíl (např. `diff`), případně vlastní jednoduchá implementace.
- Přesný formát stavových souborů ve větvi `monitor-stav`.
- Konkrétní pravidla čištění pro jednotlivé domény (vyladit podle skutečných stránek a prvních běhů).
- Kompatibilita s Node 18 lokálně (vestavěný `fetch` je k dispozici).

# Kroužky Hořice – pokyny pro Clauda

Statický web (GitHub Pages) s přehledem kroužků pro děti v Hořicích. Žádný backend, data jsou ručně (s pomocí agenta) udržované JSON soubory. Celkový plán je v `PLAN.md`, podrobné zadání a popis všech polí v `FAZE-1-IMPLEMENTACE.md` (kap. 4).

## Kde jsou data

| Soubor | Obsah |
|---|---|
| `site/data/aktivity.json` | Kroužky – vše, co se zobrazuje na kartě |
| `site/data/organizace.json` | Organizace, aktivita se na ně odkazuje přes `organizace_id` |
| `site/data/meta.json` | `aktualizovano` = datum posledního sběru dat |
| `schema/*.schema.json` | JSON Schema, závazná struktura dat |
| `data-src/zdroje.md` | Seznam zdrojů (URL stránek klubů) a poznámky ze sběru |
| `data-src/vyrazeno.json` | Kroužky a organizace vyřazené z webu (zrušené, mimo Hořice). Při vyřazení přesunout záznam sem, doplnit pole `vyrazeni` (`existuje`, `datum`, `duvod`), a smazat ho z `aktivity.json` i z `kontrola.json`. |
| `POZNAMKY.md` | **Soukromé** poznámky uživatele (úkoly, tipy, jména lidí). Je v `.gitignore` – repozitář je veřejný, proto osobní poznámky a jména konkrétních lidí patří sem, nikdy do souborů v gitu. |
| `site/js/data.js` | Číselník kategorií (`KATEGORIE`) a jejich skupiny pro filtr (`SKUPINY_KATEGORII`) |

## Postup při sběru / přegenerování dat

1. Zdroje ber z `data-src/zdroje.md` (sloupce „stránka s kroužky“ a „stránka s přihláškami“).
2. U každé aktivity aktualizuj údaje, nastav `overeno` na dnešní datum. Po dokončení nastav `meta.json` → `aktualizovano`.
3. **Neměň `id` existujících aktivit ani organizací** (jsou v odkazech a URL filtrů). Nové `id` ve tvaru `{organizace_id}-{slug}`, jen `a-z0-9-`.
4. Spusť `npm run validate` a `npm test`. Obojí musí projít.
5. Uživateli shrň, co se změnilo, a vypiš **rozpory mezi zdroji** (např. dvě stránky klubu uvádějí jiné časy) – rozhodnutí zapiš do „Poznámky ze sběru“ v `zdroje.md`.
6. Nic si nevymýšlej. Co zdroj neuvádí, je `null` / chybí. Validace kontroluje jen formát, ne pravdivost.
7. **Tabulky v PDF** (rozvrhy, kapacity) čti po řádcích: `pdftotext -raw soubor.pdf -`. Výstup `-layout` i výchozí extrakce tabulky často rozhází (sloupce se posunou proti řádkům). Přiřazení časů ke skupinám nikdy neodvozuj (např. „mladší asi chodí dřív“). Když ani `-raw` nedá jednoznačné řádky, vykresli stránku jako obrázek a přečti ji, jinak údaj nech `null` a rozpor zapiš do poznámek ze sběru. Totéž platí při ověřování existujících dat: tabulku přečti znovu, nepřebírej dřívější odhad.

## Obecná pravidla polí

- Texty česky, `popis` vlastními slovy, max. 300 znaků.
- `klicova_slova`: 2–3 slova, podle kterých by rodič kroužek hledal a která nejsou v názvu ani popisu (činnost, předmět, synonymum: `["brusle", "bruslení", "kluziště"]`). Malými písmeny, s diakritikou. Na kartě se nezobrazují, slouží jen pro vyhledávání. U ZUŠ uveď všechny nástroje, které zdroj výslovně jmenuje, a vždy `klavír`, `flétna`, `housle`, `bicí` (přání uživatele). Každý nový kroužek je má dostat rovnou.
- **Žádné osobní kontakty** (telefony a e-maily trenérů, ředitelů, WhatsApp). Jen obecné kontakty organizace (např. `sekretar@…`, `info@…`).
- Data ve formátu `YYYY-MM-DD`. Pomlčka v rozsazích je vždy `–` (en dash), ne `-`.
- `vek_od` / `vek_do`: celá čísla. Pokud zdroj uvádí ročníky narození, dopočítej věk k aktuálnímu školnímu roku a zmiň to v poznámkách ze sběru.
- `pohlavi`: vyplň jen, když zdroj výslovně říká „jen dívky / chlapci“.
- `kategorie`: klíče z číselníku (`schema/aktivity.schema.json` → `$defs.kategorie`). Aktivita může mít víc kategorií. Nová kategorie = přidat ji do schématu, do `KATEGORIE` **a** do jedné skupiny v `SKUPINY_KATEGORII` (validace hlídá všechna tři místa).
- `prihlaska.zpusob` je povinný; když není známý: `"Informace na webu organizace."`. `prubezne: true` = lze se přihlásit kdykoli.
- U DDM je `prihlaska.odkaz` vždy stránka kroužku (= `zdroj_url`, `www.ddmhorice.cz/krouzky/…`), ne přímo formulář v iDDM (`ddmhorice.iddm.cz/detail/…`). Na stránce kroužku jsou všechny údaje i odkaz do iDDM (přání uživatele).

## Termíny (`terminy`) – jak strukturovat

Cíl: na kartě se zobrazí dny pod sebou, tučně, s časy ve sloupci; skupiny a pololetí odsazeně. Proto **vždy používej strukturovaný `rozvrh`**, volný `text` jen tehdy, když se rozvrh ze zdroje sestavit nedá (pak `rozvrh` vynech).

```json
"terminy": {
  "rozvrh": [
    { "skupina": "U8 (2019)", "den": "po", "casy": ["15:30–16:45"], "misto": "tělocvična Zemědělka" },
    { "skupina": "U8 (2019)", "den": "pa", "casy": ["15:30–16:45"], "misto": null }
  ],
  "obdobi": [
    { "nazev": "1. pololetí", "termin": "29. 9. 2026 – 19. 1. 2027" },
    { "nazev": "2. pololetí", "termin": "16. 2. – 25. 5. 2027" }
  ],
  "poznamka": "Pokud není uvedeno jinak, trénuje se ve sportovní hale Gymnázia.",
  "dny": ["po", "pa"]
}
```

### `rozvrh`

- **Jedna položka = jeden den** (u jedné skupiny). „Pondělí a středa 16:30–17:10“ → dvě položky `po` a `st` se stejnými časy.
- `den`: `po`, `ut`, `st`, `ct`, `pa`, `so`, `ne`.
- `casy`: pole časů `"H:MM–H:MM"` / `"HH:MM–HH:MM"` (en dash). Více alternativních časů v jeden den (dítě chodí do jednoho z nich) = víc položek v poli: `["16:00–16:50", "17:00–17:50"]` → zobrazí se „16:00–16:50 nebo 17:00–17:50“. Čas neuveden → `[]` a do `poznamka` napiš „Časy … nejsou uvedeny.“
- `skupina`: věková/výkonnostní skupina v rámci jedné aktivity, tvar jako na webu klubu, např. `"U8 (2019)"`, `"Dívky 2010–2013"`, `"U13"`. Bez skupin → `null`. Položky téže skupiny dávej **za sebou** (seskupují se jen sousední položky) a v rámci skupiny řaď podle dne v týdnu.
- `misto`: jen když se u konkrétního dne liší od běžného místa (např. `"tělocvična Zemědělka"`). Běžné místo patří do `aktivita.misto`, případně do `poznamka` („Pokud není uvedeno jinak, …“).

### `obdobi`

- Pololetí / více pojmenovaných období → **seznam** `{ "nazev", "termin" }` (zobrazí se odsazeně s tučnými názvy). `nazev` např. `"1. pololetí"`, `"2. pololetí"`; `termin` jako text `"29. 9. 2026 – 19. 1. 2027"`.
- Jedno nepojmenované období → **text**, např. `"Podzim 2026"`, `"13 lekcí září–prosinec 2026, začátek 23. 9. 2026"`.
- Neuvedeno → `null`.

### `poznamka` a `dny`

- `poznamka`: vše ostatní k termínům (výjimky z prázdnin, výchozí místo, ročníky narození skupin, „tři skupiny, dítě má pevné místo v jedné“). Krátké věty s tečkou.
- `dny`: seřazený seznam všech dnů z `rozvrh` (po → ne). **Musí přesně odpovídat dnům v rozvrhu** – validace to kontroluje.
- `text`: nepoužívej spolu s `rozvrh`. Je jen záloha pro zdroje, kde rozvrh nejde strukturovat.

Termíny, které zdroj vůbec neuvádí → `"terminy": null` (řádek „Kdy“ se pak na kartě nezobrazí).

## Kód a testy

- Čistý JavaScript (ES moduly) bez build kroku, CSS v `site/css/style.css`. Identifikátory a komentáře česky.
- Do DOM vkládat texty z dat jen přes `textContent` (helper `el()` v `render.js`), nikdy `innerHTML`.
- `npm run dev` spustí lokální server na http://localhost:8080 (stránku nejde otevřít přímo ze souboru kvůli `fetch`).
- `npm test` (node:test), `npm run validate` (schéma + logické kontroly v `scripts/validate.mjs`).
- Při změně struktury dat uprav současně: schéma, `render.js`, validaci, testy a tabulku polí v `FAZE-1-IMPLEMENTACE.md` (existuje i kopie o úroveň výš, `../FAZE-1-IMPLEMENTACE.md`).

## Monitoring zdrojů a řešení issue

Workflow `.github/workflows/monitor.yml` (cron každý 3. den, jde spustit i ručně) stahuje zdroje z `data-src/monitor.json` a z dat (`zdroj_url`, odkazy na přihlášky, přehledy DDM a florbalu) a hlídá otisky obsahu, dostupnost a nové/zrušené kroužky v přehledech. Výsledek je GitHub issue se štítkem `monitoring` (bez nových problémů se založí a hned zavře, jen kvůli e-mailu). Do issue ani repozitáře nejde text stránek, jen URL, id, stavové kódy a otisky.

- **Obsazenost (volná místa):** u domén s pravidlem `kapacita` v `monitor.json` (DDM) se hodnota „Volná místa“ z detailu kroužku porovná s `prihlaska.kapacita` a rozdíl se v issue vypíše po kroužcích („web: volno, data: obsazeno“). Do otisku stránky se nepočítá, takže sama o sobě nevyvolá „změnu zdroje“. Neznámá hodnota z webu se hlásí jako „neznámá hodnota „…““; pak doplň převod v `scripts/monitor/kapacita.mjs` (`parsujKapacitu`).

- **Stav** je ve větvi `monitor-stav` (`stav.json`), ne v `main`. Při `--potvrdit` si skript větev obstará sám (dočasný worktree, push); v plánovaném běhu ji vyzvedne a ukládá workflow.
- **Do `main` monitoring zapisuje jen `site/data/kontrola.json`** a po commitu workflow ručně spustí nasazení (`deploy.yml`).
- **`overeno`** u kroužku a `meta.aktualizovano` znamenají **ruční ověření** podle zdroje. Datum „Data načtena“ na webu (karta i zápatí) se počítá automaticky jako pozdější z ručního ověření a poslední úspěšné kontroly (`kontrola.json`).

### Postup „vyřeš issue #N“

1. Přečti issue (`gh issue view N`) a otevři dotčené URL. Co se změnilo, ověř na stránce.
2. Oprav `aktivity.json` a `organizace.json` podle pravidel výše (včetně `overeno`). Nové kroužky z přehledů přidej celé; kroužek DDM, který se záměrně nepřidává (např. jen pro dospělé), zapiš jeho odkaz do `ignorovaneOdkazy` v `data-src/monitor.json`. Falešně nefunkční odkaz, který z běžného připojení funguje (web blokuje servery GitHubu), přidej do `nekontrolovat` (předpona URL + důvod); takové URL se pak nestahují a v e-mailu jsou jen v počtu „Nelze kontrolovat“. U rozdílu v obsazenosti stačí přepsat `prihlaska.kapacita` podle webu, v `prihlaska.poznamka` posunout datum („Obsazenost podle webu DDM k …“) a nastavit `overeno`; potvrzovat URL není nutné, rozdíl zmizí při dalším běhu sám (potvrzení ho ale smaže hned a posune datum „Data načtena“).
3. Spusť `npm run validate` a `npm test`.
4. Potvrď vyřešené URL: `npm run monitor -- --potvrdit <url…>` (nebo `--potvrdit-vse`). Nic se nestahuje, zapíše se stav z posledního běhu. Příkaz sám commitne a pushne větev `monitor-stav` (při konfliktu zkusí znovu) a aktualizuje `site/data/kontrola.json`. Výpis „Nic k potvrzení“ znamená, že už není co potvrzovat. Před potvrzením a commitem udělej `git pull` (bot commituje `kontrola.json` do `main` při každém běhu). Nepotvrzuj v okně plánovaného běhu (kolem 02:17 UTC ve dnech běhu): push stavu z workflow by pak mohl kolidovat a selhal by (selže hlasitě, další běh nálezy zopakuje).
5. Commitni změny dat a `kontrola.json` do `main` s textem `Closes #N` v popisu. Push issue zavře.

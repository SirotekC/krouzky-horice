# Rozcestník kroužků a spolků – celkový plán projektu

> Pracovní název: **Kroužky {MĚSTO}**
> Stav: návrh, verze 1.0 (2026-10-09)
> Navazující dokument: [`FAZE-1-IMPLEMENTACE.md`](./FAZE-1-IMPLEMENTACE.md) – podrobné zadání pro zahájení implementace.

---

## 1. Cíl projektu

Jedna veřejná webová stránka, kde rodiče najdou na jednom místě všechny kroužky a volnočasové aktivity pro děti v jednom městě: ZUŠ, DDM, sportovní kluby, skauty, spolky. Ke každé aktivitě stránka uvádí hlavně:

- pro jaký věk je určená,
- kde a kdy probíhá,
- kolik stojí,
- **jak a kdy se dítě může přihlásit** (to je klíčová informace),
- odkaz na původní zdroj.

Data se sbírají z veřejných webů jednotlivých organizací, které mají každý jinou strukturu, a sjednocují se do jednoho formátu.

### Nefunkční požadavky

- Jednoduchost: žádný vlastní backend server ani databáze ke správě.
- Nulové nebo minimální provozní náklady.
- Rychlost a použitelnost na mobilu, kde je většina rodičů.
- Transparentnost: každá informace má zdroj a datum ověření.

---

## 2. Klíčové architektonické rozhodnutí

### Problém: CORS

Prohlížeč nedovolí JavaScriptu na naší stránce načíst obsah cizího webu, pokud to daný web výslovně nepovolí hlavičkou `Access-Control-Allow-Origin`. Weby spolků to nedělají. Čistě klientské stahování dat v prohlížeči návštěvníka proto **není realizovatelné**. Veřejné CORS proxy jsou nespolehlivé a pro produkční službu nevhodné.

### Řešení: statický web a plánovaný sběr dat

```
[Weby spolků] ──(1× denně)──> [GitHub Actions: stažení + extrakce]
                                        │
                                        ▼
                         data/aktivity.json (verzováno v gitu)
                                        │  (pull request ke schválení)
                                        ▼
                  [Statický web na GitHub Pages]
                                        │
                                        ▼
               Prohlížeč návštěvníka: načte JSON, filtruje, vyhledává
```

- **Hosting:** GitHub Pages (zdarma, HTTPS, automatické nasazení). Alternativy jsou Cloudflare Pages a Netlify.
- **Úložiště dat:** soubory JSON v repozitáři. Databáze není potřeba, protože jde o stovky záznamů. Git navíc dává historii změn zdarma.
- **Sběr dat:** skript spouštěný podle rozvrhu (cron) v GitHub Actions. Nejde o server, který by bylo nutné spravovat.
- **Klient:** veškeré vyhledávání, filtrování a zobrazení probíhá v prohlížeči.

### Proč data ukládat, a nečíst živě

- obejde se tím CORS,
- stránka je rychlá (jeden malý JSON místo deseti webů),
- je odolná (výpadek jednoho zdroje nerozbije stránku),
- nezatěžuje weby spolků,
- umožňuje lidskou kontrolu před zveřejněním.

---

## 3. Strategie získávání dat

| Přístup | Princip | Výhody | Nevýhody | Použití |
|---|---|---|---|---|
| **Ruční zápis** | Data se přepíší do JSON ručně, případně s pomocí agenta | Nejvyšší kvalita, rychlý start | Neškáluje se | Fáze 1 |
| **Strukturované zdroje** | Otevřená data, např. rejstřík škol MŠMT | Spolehlivé | Pokrývají jen školy, ZUŠ a DDM, ne kroužky | Fáze 1 až 3 jako základ |
| **Adaptér pro každý web** | Skript s CSS selektory | Levné, deterministické | Rozbije se při redesignu webu | Jen stabilní weby |
| **Extrakce pomocí AI** | Text stránky se pošle do LLM (Claude API) se schématem a vrátí se JSON | Zvládne nestrukturované a různorodé weby | Malé náklady, nutná kontrola | Fáze 4 |

**Cílový stav je hybrid:**

1. Detekce změn (hash obsahu stránky). Nic se nezměnilo, takže se nic dalšího nedělá.
2. Při změně následuje AI extrakce do JSON a validace podle schématu.
3. Změna se uloží jako pull request a člověk ji schválí jedním kliknutím.
4. Po schválení se web automaticky znovu nasadí.

---

## 4. Datový model (shrnutí)

Dvě entity: **Organizace** (ZUŠ, klub, spolek) a **Aktivita** (konkrétní kroužek či obor). Úplné JSON schéma je ve [`FAZE-1-IMPLEMENTACE.md`](./FAZE-1-IMPLEMENTACE.md#4-datový-model).

Nejdůležitější pole aktivity: `nazev`, `organizace_id`, `kategorie`, `vek_od` a `vek_do`, `misto`, `terminy`, `cena`, `prihlaska` (způsob, období od–do, odkaz), `zdroj_url`, `overeno`.

---

## 5. Technologie

| Oblast | Volba | Důvod |
|---|---|---|
| Frontend | HTML, CSS, čistý JavaScript (ES moduly) bez build kroku | Nejjednodušší, bez závislostí, snadno pochopitelné |
| Vyhledávání | Vlastní normalizace (bez diakritiky, malá písmena), později případně Fuse.js | Pro stovky záznamů stačí |
| Mapa (možné rozšíření) | Leaflet + OpenStreetMap | Zdarma, bez API klíče |
| Validace dat | JSON Schema + Node.js skript (`ajv`) | Kontrola v CI při každém pushi |
| CI/CD | GitHub Actions | Zdarma pro veřejné repozitáře |
| Hosting | GitHub Pages | Zdarma |
| Sběr dat (fáze 3–4) | Node.js nebo Python skript v GitHub Actions | Bez serveru |
| AI extrakce (fáze 4) | Claude API se strukturovaným výstupem | Zvládne různorodé weby |

---

## 6. Fáze projektu

### Fáze 0: Příprava (1 večer)

- Účet na GitHubu, Git, VS Code a Node.js LTS.
- Výběr města a soupis 10–20 zdrojů do `data/zdroje.json`.
- Kontrola, které školy, ZUŠ a DDM jsou v rejstříku škol MŠMT (otevřená data).

### Fáze 1: Ruční prototyp, MVP (1–2 víkendy)

→ **Podrobně viz [`FAZE-1-IMPLEMENTACE.md`](./FAZE-1-IMPLEMENTACE.md).**

- Datové schéma a ručně vyplněná data pro 5–10 organizací.
- Statická stránka: seznam, karty, filtry (věk, kategorie, stav přihlášek), vyhledávání.
- Validace dat v CI a nasazení na GitHub Pages.
- Ověření zájmu u několika rodičů.

**Výstup:** veřejně dostupná funkční stránka s reálnými daty.

### Fáze 2: Vylepšení frontendu

- Detail aktivity na samostatné URL (`#/aktivita/{id}`), odkaz lze sdílet. *(Hotovo 2026-10-19: odkaz v názvu karty a tlačítko „Sdílet odkaz“.)*
- Filtry uložené v URL, takže odkaz lze sdílet.
- Zvýraznění „Přihlášky probíhají / končí za X dní“.
- Den v týdnu jako filtr (vyžaduje strukturované termíny).
- ~~Export do kalendáře (.ics) pro termíny přihlášek.~~ Zatím odloženo (rozhodnutí 2026-10-13).
- ~~Mapa aktivit.~~ Přesunuto do možných rozšíření (rozhodnutí 2026-10-19).

### Fáze 3: Automatický monitoring zdrojů

- Skript `scripts/monitor.mjs`: stáhne každý zdroj, převede ho na čistý text a spočítá hash.
- Uloží `data/cache/{zdroj_id}.txt` a `data/stav-zdroju.json` (hash, datum, HTTP status).
- GitHub Actions s cronem 1× denně. Při změně založí issue „Zdroj X se změnil“.
- Respektuje `robots.txt`, zpoždění mezi požadavky a identifikující User-Agent.

### Fáze 4: AI extrakce

- Pro změněné zdroje se pošle text do Claude API s promptem a JSON schématem.
- Výsledek se zvaliduje, porovná se stávajícími daty a vytvoří se **pull request** s rozdílem.
- Člověk PR zkontroluje a schválí. Web se nasadí automaticky.
- API klíč je uložený v GitHub Secrets. Náklady se odhadují na desítky Kč měsíčně.

### Fáze 5: Kvalita a provoz

- Kontrola nefunkčních odkazů.
- Upozornění na zastaralá data (`overeno` starší než 90 dní).
- Formulář „Nahlásit chybu / přidat kroužek“ (Google Formulář nebo GitHub Issue šablona).
- Základní analytika bez cookies (např. GoatCounter nebo Plausible), pokud bude potřeba.

### Fáze 6: Spuštění a rozvoj

- Vlastní doména (.cz, cca 250 Kč ročně).
- Stránka „O projektu“, kontakt, informace o zdrojích a ochraně údajů.
- Oslovení spolků a radnice, aby data posílaly samy.
- Podpora více měst (stejný kód, jiná konfigurace a data).

### Možná rozšíření (nejnižší priorita, až nakonec)

- Mapa aktivit (Leaflet + OpenStreetMap, využije `misto.gps`). Přesunuto z fáze 2 (rozhodnutí 2026-10-19).

---

## 7. Právní a etické zásady

- **robots.txt a šetrnost:** stahovat nejvýše 1× denně, se zpožděním a identifikovatelným User-Agentem.
- **Odkaz na zdroj:** každá aktivita odkazuje na původní web.
- **Autorská práva:** přebírat fakta (věk, cena, termín, způsob přihlášky), ne celé texty, fotografie a loga.
- **GDPR:** neuvádět jména a soukromé kontakty konkrétních osob. Používat obecné kontakty organizace (info@…, telefon recepce).
- **Přesnost:** viditelné upozornění „Informace ověřujte u pořadatele“ a datum ověření.
- **Spolupráce:** organizace mohou požádat o opravu nebo odstranění.

---

## 8. Náklady

| Položka | Cena |
|---|---|
| Hosting (GitHub Pages) | 0 Kč |
| CI a plánované úlohy (GitHub Actions) | 0 Kč (veřejný repozitář) |
| Doména .cz | volitelně, cca 250 Kč ročně |
| AI extrakce (od fáze 4) | řádově desítky Kč měsíčně |

---

## 9. Rizika

| Riziko | Dopad | Opatření |
|---|---|---|
| Zastaralá data | Uživatel přijde o termín přihlášky | Datum ověření, monitoring změn, upozornění „ověřte u pořadatele“ |
| Chybná AI extrakce | Nesprávné informace | Vždy PR s lidskou kontrolou, validace schématem |
| Změna struktury webu | Rozbitý adaptér | AI extrakce místo křehkých selektorů |
| Nesouhlas organizace | Požadavek na odstranění | Rychlé odstranění, kontakt na stránce |
| Nízký zájem | Zbytečná práce | Ověřit už ve fázi 1, před automatizací |

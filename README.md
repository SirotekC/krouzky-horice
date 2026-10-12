# Kroužky Hořice

Všechny kroužky a volnočasové aktivity pro děti v Hořicích na jednom místě: ZUŠ, DDM, sportovní kluby, skauti a spolky. U každé aktivity najdete věk, místo, termíny, cenu a hlavně **jak a kdy se přihlásit**.

Web je statický (HTML, CSS, JavaScript bez frameworku). Data jsou ručně připravené soubory JSON v repozitáři.

- Celkový plán: [PLAN.md](PLAN.md)
- Zadání fáze 1: [FAZE-1-IMPLEMENTACE.md](FAZE-1-IMPLEMENTACE.md)

## Požadavky

- [Node.js](https://nodejs.org/) LTS (18 nebo novější) – jen pro validaci dat, testy a lokální server.

## Spuštění lokálně

```bash
npm install        # nainstaluje nástroje pro validaci
npm run dev        # spustí web na http://localhost:8080
npm run validate   # zkontroluje data podle schémat
npm test           # spustí testy logiky
```

Stránku nelze otevřít dvojklikem přes `file://`, protože prohlížeč tam nenačte JSON. Vždy použijte `npm run dev`.

## Struktura

| Složka | Obsah |
|---|---|
| `site/` | Vše, co se publikuje (HTML, CSS, JS, data) |
| `site/data/` | `organizace.json`, `aktivity.json`, `meta.json` |
| `schema/` | JSON schémata dat |
| `scripts/validate.mjs` | Validace dat a referenční integrity |
| `tests/` | Testy čistých funkcí (`node:test`) |
| `data-src/zdroje.md` | Soupis zdrojů a poznámky ze sběru dat |

## Jak přidat aktivitu

1. Otevřete `site/data/aktivity.json`.
2. Zkopírujte existující záznam a upravte hodnoty. Popis polí je v [FAZE-1-IMPLEMENTACE.md, sekce 4](FAZE-1-IMPLEMENTACE.md#4-datový-model).
3. `id` musí být unikátní, jen malá písmena bez diakritiky, číslice a pomlčky (např. `zus-horice-klavir`).
4. `organizace_id` musí odpovídat `id` organizace v `organizace.json`.
5. Vyplňte `zdroj_url` (odkud údaj je) a `overeno` (dnešní datum ve tvaru `RRRR-MM-DD`).
6. Spusťte `npm run validate`.

Podrobný návod pro úpravy přes webové rozhraní GitHubu bude doplněn po nasazení.

## Licence

Kód je pod licencí [MIT](LICENSE). Údaje o kroužcích pocházejí z webů uvedených organizací. Informace vždy ověřujte u pořadatele.

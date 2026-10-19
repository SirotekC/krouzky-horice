# Zdroje dat – Hořice

> Stav: **návrh k potvrzení** (průzkum webů 2026-10-12). Přehled sportovních klubů na webu města: https://www.horice.org/sportovni/ms-10145/p1=11489

## Navržené zdroje (seřazeno podle kvality dat)

| id | název | typ | web | stránka s kroužky | stránka s přihláškami | poznámka |
|---|---|---|---|---|---|---|
| ddm-horice | Dům dětí a mládeže Hořice | ddm | https://www.ddmhorice.cz | https://www.ddmhorice.cz/krouzky | https://ddmhorice.iddm.cz ; https://www.ddmhorice.cz/hlavni-udalosti/159-prihlasovani-do-krouzku-2026-2027-je-spusteno | 80 kroužků pro 2026/27, každý má detail `/krouzky/{číslo}-{slug}` se strukturovanými poli (věk, dny a časy, místo, cena za pololetí, zahájení a ukončení, volná místa) a odkazem do iDDM. Přihlášky online od 26. 8. 2026. |
| plavani-sporthorice | Sportovní zařízení města Hořice – plavecké kroužky | jine | https://www.sporthorice.cz | https://www.sporthorice.cz/plavecke-krouzky/ ; https://www.sporthorice.cz/plavecky-oddil-rejnok/ | https://rezervace.sporthorice.cz | 6 kurzů + oddíl Rejnok, 2026/27, věk, čas, cena. |
| florbal-horice | FBK Hořice, z.s. | sportovni-klub | https://www.florbalhorice.cz | https://www.florbalhorice.cz/treninky | https://www.florbalhorice.cz/pridej-se-k-nam | Asi 19 mládežnických skupin, ročníky narození, nábor od 2. 9. 2026. Bez cen. |
| zus-horice | Základní umělecká škola Hořice | zus | https://zushorice.cz | https://zushorice.cz/o-skole/studium/ | https://zushorice.cz/o-skole/prihlaska/ | Ceník 2026/27: https://zushorice.cz/o-skole/cenik-skolneho/. Zápis byl v červnu 2026. Stránka „Studium“ má v nadpisu ještě 2024/2025. |
| tj-sokol-horice | T. J. Sokol Hořice | sportovni-klub | https://www.sokol.eu/sokolovna/tj-sokol-horice | tamtéž | – | Vlastní web nenalezen. 4 dětské skupiny. Údaje se liší od webu města. Bez cen. |
| junak-horice | Junák – český skaut, středisko Hořice | spolek | https://www.junakhorice.cz | https://www.junakhorice.cz/hledam-oddil/ | https://www.junakhorice.cz/hledam-oddil/pro-rodice/ | 3 oddíly, věk a den schůzky. Web oddílu Jitřenka se nenačetl. |
| fotbal-jiskra-horice | TJ Jiskra Hořice – fotbal | sportovni-klub | https://www.horickyfotbal.cz | soupisky kategorií U7–U19 | – | Bez tréninků, náboru a cen. |
| rebels-gym | Rebels Gym Hořice | sportovni-klub | https://www.rebelsgym.cz | https://www.rebelsgym.cz/detske-treninky/ | – | Gymčata 3–5 let, Rebeláci 6–12 let. Podstránky zatím neověřeny. |
| volejbal-horice | Volejbal Hořice | sportovni-klub | https://www.horice.org/volejbal/ms-11400/p1=11400 | tamtéž | – | Jen stránka města: minivolejbal 6–14 let, Út a Čt. |
| spv-horice | Sport pro všechny Hořice | sportovni-klub | https://www.horice.org/sport%2Dpro%2Dvsechny/ms-11788/p1=11788 | tamtéž | – | Jen stránka města, děti od 4 let. Zbytek na Facebooku. |

## Zvažované, zatím nezařazené

| id | název | důvod |
|---|---|---|
| ob-horice | Orientační běh Hořice (https://www.obhorice.cz) | Web neuvádí trénink mládeže. |
| knihovna-horice | Městská knihovna Hořice | Nemá pravidelné kroužky, jen jednorázové akce. |
| lmk-horice | Leteckomodelářský klub Hořice | Kroužek běží v DDM (duplicita), zmínka z roku 2019. |
| stolni-tenis-horice | Stolní tenis TJ Jiskra Hořice | Informace z roku 2022. |
| tenis-horice | TC Hořice | Web neaktualizovaný od 2022, nábor z 2019. |
| – | Šachy, basketbal, box, MMA, SDH (mladí hasiči) | Bez ověřitelné nabídky pro děti nebo jen Facebook. Šachy pokrývá DDM. |

## Poznámky ze sběru (2026-10-12)

- **DDM** je zatím jedna souhrnná aktivita. Vlastní řešení pro jednotlivé kroužky (asi 70) přijde později. Začátek činnosti web uvádí jako 29. 9. i 29. 10. 2026. Přihlášky jsou online přes iDDM od 26. 8. 2026.
- **Sokol:** sokol.eu a web města uvádějí rozdílné skupiny a časy. Použit sokol.eu, rozpor je v poznámkách aktivit.
- **ZUŠ:** přijímací řízení 2026/2027 proběhlo v červnu, termín dalšího kola web neuvádí. Ceny jsou z ceníku, ne ze stránek oborů.
- **Florbal:** stránky /treninky a /pridej-se-k-nam se v časech liší. Použita náborová stránka. Věk je dopočítaný z ročníků narození.
- **Fotbal:** aktivity sdružují více kategorií. Nábor ani ceny web neuvádí.
- **Rebels Gym:** u Gymčat je „Kapacita: 0“, nejasné, zda jde o obsazený kurz.
- **Volejbal a SPV:** k dispozici jen stránka na webu města, chybí časy a ceny.
- **Osobní kontakty** (telefony trenérů, ředitelů, WhatsApp, osobní e-maily) záměrně vynechány.

## Poznámky ze sběru (2026-10-19) – DDM po jednotlivých kroužcích

- Souhrnná aktivita `ddm-horice-krouzky` byla nahrazena **63 samostatnými kroužky** (id `ddm-horice-{slug z webu}`). Údaje jsou z detailů kroužků, popisy jsou přepsané vlastními slovy.
- **Vynecháno 17 kroužků jen pro dospělé:** Fit dance, H.I.I.T. (2×), Maminky v kondici, Francouzština, Cvičení s Ditou, Italština, Cvičení s Ivou, Angličtina na cesty, Keramika pondělní (senioři), Zdravotní cvičení, Keramika pro dospělé, Scrapbooking, Latina pro ženy, Kurz šití pro dospělé, Pole dance (2×).
- Horní hranice věku nad 26 let (kytara, ukulele, paličkování, keramika 14+) je uložená jako „bez horní hranice“, protože schéma povoluje nejvýš 26.
- `pohlavi: divky` jen tam, kde popis výslovně říká dívky, holčičky nebo slečny (mažoretky a roztleskávačky PHOENIX, Tanečky pro Berušky, Formace kadetek).
- Volná místa jsou v poznámce k přihlášce se stavem k 19. 10. 2026 – rychle stárnou.
- **Rozpory:**
  - Novinka na hlavní stránce: „pravidelná činnost začíná od 29. října 2026“, ale detaily kroužků uvádějí zahájení od 14. 9. do 13. 10. 2026. Použita data z detailů.
  - Judo pokročilí: popis „oba dny 16:00–17:30“, rozvrh ve čtvrtek 16:00–17:00. Použit rozvrh, rozpor je v poznámce aktivity.
  - Mažoretky a roztleskávačky PHOENIX Kadetky: rozvrh uvádí tři dny s širokými časovými rozmezími, popis „2× týdně, středa jednou za 14 dní, přesné časy v září“. Použit rozvrh s poznámkou.
  - Juniorky PHOENIX: místo „ZŠ Na Habru“, ale popis uvádí pondělí v Sokolovně. Pondělí má v rozvrhu vlastní místo.
  - Kuželky: rozvrh uvádí pondělí i středu, ve skutečnosti jen jeden den podle domluvy (v poznámce).
- Formace PHOENIX (seniorky), Formace kadetek a Formace Little kadetky nemají vyplněné datum zahájení a ukončení.

## Tipy od uživatele – čekají na hromadný import

> Průběžně sbírané tipy. Zatím neověřeno, zpracuje se hromadně později.

| přidáno | web | poznámka |
|---|---|---|
| 2026-10-13 | https://rckonvicka.cz/ | Tip na další zdroj kroužků v Hořicích. Zatím neprozkoumáno. |

## Zjištění pro fázi 3–4

_(doplní se v úkolu 8)_

// Souhrn běhu monitoringu do issue: název, tělo v Markdownu a rozhodnutí, zda issue hned zavřít.
// Do issue jde jen URL, id, názvy polí, stavové kódy, počty a data – nikdy text stránek.
// Výjimkou je obsazenost: hodnota z pevného číselníku (neznámá hodnota zkrácená, viz kapacita.mjs).

import { popisKapacity } from './kapacita.mjs';

/**
 * Český tvar podle počtu (1 / 2–4 / 0 a 5+), jako ve validate.mjs.
 * @param {number} n
 * @param {[string, string, string]} tvary
 * @returns {string}
 */
function tvar(n, [jeden, dva, pet]) {
  return `${n} ${n === 1 ? jeden : n >= 2 && n <= 4 ? dva : pet}`;
}

/** Části názvu issue: [počet, tvary] v pořadí, ve kterém se vypisují. */
function castiNazvu(n) {
  return [
    [n.zmeny.nove.length, ['nová změna', 'nové změny', 'nových změn']],
    [n.chyby.nove.length, ['nový nefunkční odkaz', 'nové nefunkční odkazy', 'nových nefunkčních odkazů']],
    [n.odmitnuto.nove.length, ['nové odmítnutí kontroly', 'nová odmítnutí kontroly', 'nových odmítnutí kontroly']],
    [n.prehledy.nove.length, ['nový kroužek v přehledech', 'nové kroužky v přehledech', 'nových kroužků v přehledech']],
    [n.prehledy.zrusene.length, ['zrušený kroužek v přehledech', 'zrušené kroužky v přehledech', 'zrušených kroužků v přehledech']],
    [n.presmerovani.nove.length, ['nové přesměrování', 'nová přesměrování', 'nových přesměrování']],
    [n.kapacita.nove.length, ['nový rozdíl v obsazenosti', 'nové rozdíly v obsazenosti', 'nových rozdílů v obsazenosti']],
  ].filter(([pocet]) => pocet > 0).map(([pocet, tvary]) => tvar(pocet, tvary));
}

/** `id (pole), id (pole)` z použití URL. */
function popisPouziti(pouziti) {
  return (pouziti ?? []).map((p) => `${p.id} (${p.pole})`).join(', ');
}

/** `id – web: …, data: …` pro každý kroužek s rozdílnou obsazeností. */
function radkyKapacity(polozky) {
  return polozky.flatMap((p) => p.rozdily.map((r) =>
    `- ${r.id} – web: ${popisKapacity(p.web)}, data: ${popisKapacity(r.data)} – ${p.url}`));
}

/** Stavový kód, nebo druh chyby, když kód není (dns, timeout…). */
function kodChyby(polozka) {
  return polozka.status != null ? String(polozka.status) : polozka.druh;
}

/**
 * Sestaví issue z nálezů běhu.
 * @param {object} nalezy výstup `vyhodnotBeh` (scripts/monitor/stav.mjs)
 * @param {string} dnes YYYY-MM-DD
 * @returns {{ nazev: string, telo: string, zavrit: boolean }}
 */
export function sestavIssue(nalezy, dnes) {
  const n = nalezy;
  const casti = castiNazvu(n);
  const nazev = `Kontrola zdrojů ${dnes}: ${casti.length ? casti.join(', ') : 'bez nových problémů'}`;

  const radky = [];
  radky.push(`Zkontrolováno ${n.zkontrolovano} URL.${n.beZmeny304
    ? ` U ${n.beZmeny304} z nich server rovnou potvrdil, že se od minulé kontroly nezměnily, takže se nemusely znovu stahovat.`
    : ''}`);
  const prepocet = [];
  if (n.noveSledovano) prepocet.push(`Nově sledováno: ${n.noveSledovano}`);
  if (n.prepocitano) prepocet.push(`přepočítáno po změně pravidel: ${n.prepocitano}`);
  if (prepocet.length) {
    const radek = prepocet.join(' · ');
    radky.push('', radek[0].toUpperCase() + radek.slice(1));
  }

  radky.push(
    '',
    '| | nové | přetrvávající |',
    '|---|---|---|',
    `| Změněné zdroje | ${n.zmeny.nove.length} | ${n.zmeny.pretrvavajici.length} |`,
    `| Nefunkční odkazy | ${n.chyby.nove.length} | ${n.chyby.pretrvavajici.length} |`,
    `| Server odmítl kontrolu | ${n.odmitnuto.nove.length} | ${n.odmitnuto.pretrvavajici.length} |`,
    `| Nové / zrušené kroužky v přehledech | ${n.prehledy.nove.length} / ${n.prehledy.zrusene.length} | ${n.prehledy.pretrvavajici} |`,
    `| Přesměrované odkazy | ${n.presmerovani.nove.length} | – |`,
    `| Rozdíly v obsazenosti (volná místa) | ${n.kapacita.nove.length} | ${n.kapacita.pretrvavajici.length} |`,
    `| Přeskočeno (robots.txt) | – | ${n.preskoceno.filter((p) => p.duvod === 'robots').length} |`,
    `| Nelze kontrolovat (viz monitor.json) | – | ${n.preskoceno.filter((p) => p.duvod === 'nekontrolovat').length} |`,
  );

  function sekce(nadpis, polozky) {
    if (polozky.length) radky.push('', `## ${nadpis}`, ...polozky);
  }
  sekce('Nové změny zdrojů', n.zmeny.nove.map((p) => `- ${p.url} – ${popisPouziti(p.pouziti)}`));
  sekce('Nové a zrušené kroužky v přehledech', [
    ...n.prehledy.nove.map((p) => `- nový: ${p.url} (přehled ${p.prehled})`),
    ...n.prehledy.zrusene.map((p) => `- zrušený: ${p.url} (přehled ${p.prehled})`),
  ]);
  sekce('Nové nefunkční odkazy', n.chyby.nove.map((p) => `- ${p.url} – ${kodChyby(p)} – ${popisPouziti(p.pouziti)}`));
  sekce('Server odmítl kontrolu', n.odmitnuto.nove.map((p) => `- ${p.url} – ${kodChyby(p)} – ${popisPouziti(p.pouziti)}`));
  sekce('Přesměrované odkazy', n.presmerovani.nove.map((p) => `- ${p.url} → ${p.cil} – ${popisPouziti(p.pouziti)}`));
  sekce('Nové rozdíly v obsazenosti', radkyKapacity(n.kapacita.nove));

  const pretrvavajici = [
    ...n.zmeny.pretrvavajici.map((p) => `- ${p.url} – změna – ${popisPouziti(p.pouziti)}`),
    ...n.chyby.pretrvavajici.map((p) => `- ${p.url} – ${kodChyby(p)} – ${popisPouziti(p.pouziti)}`),
    ...n.odmitnuto.pretrvavajici.map((p) => `- ${p.url} – odmítnuto ${kodChyby(p)} – ${popisPouziti(p.pouziti)}`),
    ...radkyKapacity(n.kapacita.pretrvavajici).map((r) => r.replace(' – web: ', ' – obsazenost – web: ')),
  ];
  if (n.prehledy.pretrvavajici) pretrvavajici.push(`- nevyřešené kroužky v přehledech: ${n.prehledy.pretrvavajici}`);
  const pocetPretrvavajicich = pretrvavajici.length - (n.prehledy.pretrvavajici ? 1 : 0) + n.prehledy.pretrvavajici;
  if (pretrvavajici.length) {
    radky.push('', `<details><summary>Přetrvávající problémy (${pocetPretrvavajicich})</summary>`, '', ...pretrvavajici, '', '</details>');
  }
  if (n.preskoceno.length) {
    radky.push('', `<details><summary>Přeskočeno (${n.preskoceno.length})</summary>`, '',
      ...n.preskoceno.map((p) => `- ${p.url} – ${p.duvod === 'nekontrolovat' ? 'nelze kontrolovat' : p.duvod}`), '', '</details>');
  }

  radky.push('', 'Vyřešit: napiš agentovi „vyřeš issue #…“.');

  const zavrit = casti.length === 0;
  return { nazev, telo: `${radky.join('\n')}\n`, zavrit };
}

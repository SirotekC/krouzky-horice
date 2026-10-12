// Načtení a příprava dat. Číselníky jsou definované jen zde (validační skript
// kontroluje, že kategorie souhlasí s `schema/aktivity.schema.json`).

/** Číselník kategorií: klíč → popisek v UI. Pořadí určuje pořadí filtrů. */
export const KATEGORIE = Object.freeze({
  hudba: 'Hudba',
  vytvarne: 'Výtvarné a rukodělné',
  tanec: 'Tanec',
  divadlo: 'Divadlo a literatura',
  'sport-mickove': 'Míčové sporty',
  'sport-ostatni': 'Ostatní sporty',
  bojove: 'Bojová umění',
  plavani: 'Plavání a vodní sporty',
  priroda: 'Příroda a skauting',
  technika: 'Technika, programování, robotika',
  veda: 'Věda a vzdělávání',
  jazyky: 'Jazyky',
  ostatni: 'Ostatní',
});

/** Pohlaví, pro které je aktivita určená: klíč → popisek na kartě. */
export const POHLAVI = Object.freeze({
  divky: 'Jen dívky',
  chlapci: 'Jen chlapci',
});

/** Typy organizací: klíč → popisek v UI. */
export const TYPY_ORGANIZACI = Object.freeze({
  zus: 'Základní umělecká škola',
  ddm: 'Dům dětí a mládeže',
  'sportovni-klub': 'Sportovní klub',
  spolek: 'Spolek',
  skola: 'Škola',
  jine: 'Jiné',
});

async function nactiJson(url) {
  const odpoved = await fetch(url, { cache: 'no-cache' });
  if (!odpoved.ok) throw new Error(`Nepodařilo se načíst ${url} (HTTP ${odpoved.status}).`);
  return odpoved.json();
}

/**
 * Spojí aktivity s organizacemi. Každá aktivita dostane vlastnost `organizace`
 * (objekt organizace, nebo `null`, pokud neexistuje).
 */
export function pripravData(organizace, aktivity) {
  const organizaceMapa = new Map(organizace.map((o) => [o.id, o]));
  const spojene = aktivity.map((a) => ({ ...a, organizace: organizaceMapa.get(a.organizace_id) ?? null }));
  return { organizace, organizaceMapa, aktivity: spojene };
}

/** Načte všechny tři datové soubory paralelně. */
export async function nactiData(zaklad = 'data/') {
  const [organizace, aktivity, meta] = await Promise.all([
    nactiJson(`${zaklad}organizace.json`),
    nactiJson(`${zaklad}aktivity.json`),
    nactiJson(`${zaklad}meta.json`),
  ]);
  return { ...pripravData(organizace, aktivity), meta };
}

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

/**
 * Hlavní skupiny kategorií pro filtr: klíč → popisek a kategorie, které do skupiny patří.
 * Každá kategorie patří právě do jedné skupiny (kontroluje validační skript). Pořadí určuje pořadí filtrů.
 */
export const SKUPINY_KATEGORII = Object.freeze({
  sport: { popisek: 'Sport', kategorie: ['sport-mickove', 'sport-ostatni', 'bojove', 'plavani'] },
  umeni: { popisek: 'Umění', kategorie: ['hudba', 'vytvarne', 'tanec', 'divadlo'] },
  veda: { popisek: 'Věda a technika', kategorie: ['technika', 'veda', 'jazyky'] },
  priroda: { popisek: 'Příroda a skauting', kategorie: ['priroda'] },
  ostatni: { popisek: 'Ostatní', kategorie: ['ostatni'] },
});

/** Vrátí klíč skupiny, do které kategorie patří, nebo `null`. */
export function skupinaKategorie(kategorie) {
  for (const [klic, skupina] of Object.entries(SKUPINY_KATEGORII)) {
    if (skupina.kategorie.includes(kategorie)) return klic;
  }
  return null;
}

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

/** Počty pro hlavičku: kroužky, použité kategorie a organizace, které mají aspoň jeden kroužek. */
export function statistiky(aktivity) {
  return {
    krouzky: aktivity.length,
    kategorie: new Set(aktivity.flatMap((a) => a.kategorie)).size,
    organizace: new Set(aktivity.map((a) => a.organizace_id)).size,
  };
}

/**
 * Sjednotí URL pro porovnávání: odstraní #fragment, hostname převede na malá písmena
 * a odstraní koncové lomítko jen u kořenové cesty (`https://a.cz/` → `https://a.cz`).
 * Stejnou normalizaci používá monitoring zdrojů pro klíče v `kontrola.json`.
 * @param {string} url
 * @returns {string}
 */
export function normalizujUrl(url) {
  const u = new URL(url);
  u.hash = '';
  const text = u.href; // hostname je v href už malými písmeny
  return u.pathname === '/' && !u.search ? text.replace(/\/$/, '') : text;
}

/** Pozdější z dvou dat `YYYY-MM-DD` (chybějící se ignoruje). */
function pozdejsi(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Datum, ke kterému jsou údaje aktivity načtené: pozdější z ručního `overeno`
 * a z poslední úspěšné kontroly zdroje (`kontrola.json`, klíč je normalizovaná URL).
 * @param {{ overeno: string, zdroj_url?: string }} aktivita
 * @param {{ url?: Record<string, string> } | null} kontrola
 * @returns {string}
 */
export function datumNacteni(aktivita, kontrola) {
  let kontrolovano = null;
  if (aktivita.zdroj_url) {
    try {
      kontrolovano = kontrola?.url?.[normalizujUrl(aktivita.zdroj_url)] ?? null;
    } catch {
      // neplatná URL: použije se jen ruční datum
    }
  }
  return pozdejsi(aktivita.overeno, kontrolovano);
}

/**
 * Datum načtení dat pro zápatí: pozdější z `meta.aktualizovano` a data posledního běhu kontroly zdrojů.
 * @param {{ aktualizovano: string }} meta
 * @param {{ zdrojeZkontrolovany?: string | null } | null} kontrola
 * @returns {string}
 */
export function datumNacteniWebu(meta, kontrola) {
  return pozdejsi(meta.aktualizovano, kontrola?.zdrojeZkontrolovany ?? null);
}

/** Načte datové soubory paralelně. `kontrola.json` je nepovinný: při chybě je `kontrola` `null`. */
export async function nactiData(zaklad = 'data/') {
  const [organizace, aktivity, meta, kontrola] = await Promise.all([
    nactiJson(`${zaklad}organizace.json`),
    nactiJson(`${zaklad}aktivity.json`),
    nactiJson(`${zaklad}meta.json`),
    nactiJson(`${zaklad}kontrola.json`).catch(() => null),
  ]);
  return { ...pripravData(organizace, aktivity), meta, kontrola };
}

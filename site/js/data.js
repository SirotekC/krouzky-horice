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
  priroda: 'Příroda a turistika',
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
  priroda: { popisek: 'Příroda a turistika', kategorie: ['priroda'] },
  ostatni: { popisek: 'Ostatní', kategorie: ['ostatni'] },
});

/**
 * Číselník kategorií aktivit pro dospělé (`schema/aktivity-dospeli.schema.json`). Klíče společné
 * s dětmi mají stejný význam, aby se dětská aktivita s `i_pro_dospele` zařadila i mezi dospělé.
 */
export const KATEGORIE_DOSPELI = Object.freeze({
  cviceni: 'Cvičení a fitness',
  joga: 'Jóga, pilates a relaxace',
  tanec: 'Tanec',
  'sport-mickove': 'Míčové sporty',
  'sport-ostatni': 'Ostatní sporty',
  hudba: 'Hudba a zpěv',
  vytvarne: 'Výtvarné a rukodělné',
  divadlo: 'Divadlo a literatura',
  jazyky: 'Jazyky',
  vzdelavani: 'Přednášky a kurzy',
  priroda: 'Příroda a turistika',
  ostatni: 'Ostatní',
});

/** Skupiny kategorií pro dospělé, stejná pravidla jako `SKUPINY_KATEGORII`. */
export const SKUPINY_KATEGORII_DOSPELI = Object.freeze({
  pohyb: { popisek: 'Pohyb', kategorie: ['cviceni', 'joga', 'tanec', 'sport-mickove', 'sport-ostatni'] },
  kultura: { popisek: 'Kultura a tvoření', kategorie: ['hudba', 'vytvarne', 'divadlo'] },
  vzdelavani: { popisek: 'Vzdělávání', kategorie: ['jazyky', 'vzdelavani'] },
  priroda: { popisek: 'Příroda a turistika', kategorie: ['priroda'] },
  ostatni: { popisek: 'Ostatní', kategorie: ['ostatni'] },
});

/** Úroveň aktivity pro dospělé: klíč → popisek. */
export const UROVNE = Object.freeze({
  zacatecnici: 'Začátečníci',
  pokrocili: 'Pokročilí',
  vsichni: 'Všechny úrovně',
});

/** Pro koho je aktivita pro dospělé určená: klíč → popisek. */
export const URCENO_PRO = Object.freeze({
  zeny: 'Ženy',
  muzi: 'Muži',
  seniori: 'Senioři',
  tehotne: 'Těhotné',
});

/** Jak se na aktivitu dostat (`prihlaska.typ`): klíč → popisek. */
export const TYPY_VSTUPU = Object.freeze({
  'bez-prihlasky': 'Bez přihlášky',
  rezervace: 'Rezervace předem',
  prihlaska: 'Přihláška na kurz',
});

/**
 * Vrátí klíč skupiny, do které kategorie patří, nebo `null`.
 * @param {string} kategorie
 * @param {Record<string, { kategorie: string[] }>} [skupiny] číselník skupin sekce
 */
export function skupinaKategorie(kategorie, skupiny = SKUPINY_KATEGORII) {
  for (const [klic, skupina] of Object.entries(skupiny)) {
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

/** Organizace, které mají v `aktivity` aspoň jednu aktivitu (pořadí zůstává jako v `organizace`). */
export function organizaceSAktivitou(organizace, aktivity) {
  const sAktivitou = new Set(aktivity.map((a) => a.organizace_id));
  return organizace.filter((o) => sAktivitou.has(o.id));
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

/**
 * Načte datové soubory paralelně. `kontrola.json` je nepovinný: při chybě je `kontrola` `null`.
 * Se zadanou sekcí (`SEKCE` ze `sekce.js`) načte její aktivity a z druhé sekce přidá ty, které mají
 * příznak `sekce.priznakZDruhe`; soubor druhé sekce je nepovinný. Každá aktivita pak nese `sekce`.
 * Bez sekce načte jen `aktivity.json`.
 * @param {string} [zaklad]
 * @param {{ klic: string, soubor: string, priznakZDruhe: string } | null} [sekce]
 * @param {{ klic: string, soubor: string } | null} [druha]
 */
export async function nactiData(zaklad = 'data/', sekce = null, druha = null) {
  const [organizace, vlastni, zDruhe, meta, kontrola] = await Promise.all([
    nactiJson(`${zaklad}organizace.json`),
    nactiJson(`${zaklad}${sekce?.soubor ?? 'aktivity.json'}`),
    druha ? nactiJson(`${zaklad}${druha.soubor}`).catch(() => []) : [],
    nactiJson(`${zaklad}meta.json`),
    nactiJson(`${zaklad}kontrola.json`).catch(() => null),
  ]);
  const aktivity = sekce
    ? [
        ...vlastni.map((a) => ({ ...a, sekce: sekce.klic })),
        ...zDruhe.filter((a) => a[sekce.priznakZDruhe] === true).map((a) => ({ ...a, sekce: druha.klic })),
      ]
    : vlastni;
  return { ...pripravData(organizace, aktivity), meta, kontrola };
}

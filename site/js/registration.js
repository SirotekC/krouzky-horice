// Výpočet stavu přihlášek a práce s kalendářními daty.
// Čisté funkce bez přístupu k DOM, aby šly testovat v Node.js.

const DEN_MS = 24 * 60 * 60 * 1000;

/** Počet dní, za které je ukončení přihlášek ještě zvýrazněné. */
export const KONCI_BRZY_DNI = 7;
/** Počet dní do začátku přihlášek, kdy jde o stav „brzy“. */
export const BRZY_DNI = 30;

/** Stavy přihlášek v pořadí, ve kterém se řadí výsledky. */
export const PORADI_STAVU = ['probiha', 'brzy', 'prubezne', 'nahradnici', 'planovano', 'neznamy', 'obsazeno', 'ukonceno'];

/**
 * Ručně parsuje datum `YYYY-MM-DD` (ne přes `new Date(text)`, které ho bere jako UTC čas).
 * @returns {{ rok: number, mesic: number, den: number } | null}
 */
export function parseDatum(text) {
  if (typeof text !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const rok = Number(m[1]);
  const mesic = Number(m[2]);
  const den = Number(m[3]);
  const kontrola = new Date(Date.UTC(rok, mesic - 1, den));
  if (kontrola.getUTCMonth() !== mesic - 1 || kontrola.getUTCDate() !== den) return null;
  return { rok, mesic, den };
}

/** Převede datum `YYYY-MM-DD` na pořadové číslo kalendářního dne (pro porovnání a rozdíly). */
export function cisloDne(text) {
  const d = parseDatum(text);
  if (!d) return null;
  return Date.UTC(d.rok, d.mesic - 1, d.den) / DEN_MS;
}

/** Rozdíl ve dnech `do − od`. */
export function rozdilDni(od, doData) {
  return cisloDne(doData) - cisloDne(od);
}

/** Dnešní datum jako `YYYY-MM-DD` v časovém pásmu Europe/Prague. */
export function dnesPraha(ted = new Date()) {
  // Locale en-CA formátuje datum jako YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ted);
}

/** Posune datum `YYYY-MM-DD` o zadaný počet dní. */
export function posunDatum(text, dni) {
  const d = new Date((cisloDne(text) + dni) * DEN_MS);
  return d.toISOString().slice(0, 10);
}

/**
 * Formát `d. m. rrrr` (např. „1. 5. 2027“), s `rok: false` jen `d. m.`.
 * Pro neplatné datum vrací prázdný řetězec.
 */
export function formatDatum(text, { rok = true } = {}) {
  const d = parseDatum(text);
  if (!d) return '';
  return rok ? `${d.den}. ${d.mesic}. ${d.rok}` : `${d.den}. ${d.mesic}.`;
}

/** Období přihlášek, např. „1. 5. – 15. 6. 2027“. */
export function formatObdobi(od, doData) {
  const a = parseDatum(od);
  const b = parseDatum(doData);
  if (a && b) {
    const zacatek = a.rok === b.rok ? formatDatum(od, { rok: false }) : formatDatum(od);
    return `${zacatek} – ${formatDatum(doData)}`;
  }
  if (a) return `od ${formatDatum(od)}`;
  if (b) return `do ${formatDatum(doData)}`;
  return '';
}

/** „1 den“, „2 dny“, „5 dní“. */
export function dniSlovy(pocet) {
  if (pocet === 1) return '1 den';
  if (pocet >= 2 && pocet <= 4) return `${pocet} dny`;
  return `${pocet} dní`;
}

function textProbiha(doData, dnes) {
  if (!doData) return 'Přihlášky probíhají';
  const zbyva = rozdilDni(dnes, doData);
  if (zbyva === 0) return 'Končí dnes';
  if (zbyva <= KONCI_BRZY_DNI) return `Končí za ${dniSlovy(zbyva)}`;
  return `Přihlášky do ${formatDatum(doData, { rok: false })}`;
}

/** „Poslední místo“, „Poslední 3 místa“, „Posledních 5 míst“; bez počtu „Poslední místa“. */
export function textPoslednichMist(pocet) {
  if (pocet === 1) return 'Poslední místo';
  if (pocet >= 2 && pocet <= 4) return `Poslední ${pocet} místa`;
  if (pocet >= 5) return `Posledních ${pocet} míst`;
  return 'Poslední místa';
}

/**
 * Stav přihlášek k danému dni (pravidla v FAZE-1-IMPLEMENTACE.md, sekce 5.2).
 * Obsazenost (`kapacita`) se promítne jen do běžících přihlášek (`probiha`, `prubezne`);
 * před začátkem a po konci přihlášek platí stav podle data.
 * @param {{ od?: string|null, do?: string|null, prubezne?: boolean, kapacita?: { stav: string, volna_mista?: number|null }|null }} prihlaska
 * @param {string} dnes datum `YYYY-MM-DD`
 * @returns {{ stav: string, text: string }}
 */
export function stavPrihlasky(prihlaska, dnes) {
  const podleData = stavPodleData(prihlaska, dnes);
  if (podleData.stav !== 'probiha' && podleData.stav !== 'prubezne') return podleData;
  switch (prihlaska?.kapacita?.stav) {
    case 'obsazeno':
      return { stav: 'obsazeno', text: 'Obsazeno' };
    case 'nahradnici':
      return { stav: 'nahradnici', text: 'Plno – berou náhradníky' };
    case 'posledni':
      return { stav: podleData.stav, text: textPoslednichMist(prihlaska.kapacita.volna_mista) };
    default:
      return podleData;
  }
}

function stavPodleData(prihlaska, dnes) {
  const od = parseDatum(prihlaska?.od) ? prihlaska.od : null;
  const doData = parseDatum(prihlaska?.do) ? prihlaska.do : null;
  const d = cisloDne(dnes);

  if (od && doData && cisloDne(od) <= d && d <= cisloDne(doData)) {
    return { stav: 'probiha', text: textProbiha(doData, dnes) };
  }
  if (od && d < cisloDne(od)) {
    if (rozdilDni(dnes, od) <= BRZY_DNI) {
      return { stav: 'brzy', text: `Přihlášky od ${formatDatum(od, { rok: false })}` };
    }
    return { stav: 'planovano', text: `Přihlášky od ${formatDatum(od)}` };
  }
  // Doplněno nad rámec tabulky v zadání: přihlášky začaly a konec není uveden.
  if (od && !doData && cisloDne(od) <= d && prihlaska?.prubezne !== true) {
    return { stav: 'probiha', text: 'Přihlášky probíhají' };
  }
  if (!od && doData && d <= cisloDne(doData)) {
    return { stav: 'probiha', text: textProbiha(doData, dnes) };
  }
  if (prihlaska?.prubezne === true) {
    return { stav: 'prubezne', text: 'Průběžný nábor' };
  }
  if (doData && d > cisloDne(doData)) {
    return { stav: 'ukonceno', text: 'Přihlášky ukončeny' };
  }
  return { stav: 'neznamy', text: 'Termín přihlášek neuveden' };
}

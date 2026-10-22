// Vyhodnocení běhu monitoringu: z předchozího stavu a nových měření spočítá nový stav
// a nálezy pro issue (co je nové, co přetrvává). Čisté funkce, bez I/O.

/**
 * Prázdný stav pro první běh.
 * @returns {{ verze: 1, posledniBeh: null, zapatiDatum: null, url: {} }}
 */
export function prazdnyStav() {
  return { verze: 1, posledniBeh: null, zapatiDatum: null, url: {} };
}

function prazdneNalezy() {
  return {
    zkontrolovano: 0,
    beZmeny304: 0,
    noveSledovano: 0,
    prepocitano: 0,
    preskoceno: [],
    zmeny: { nove: [], pretrvavajici: [] },
    chyby: { nove: [], pretrvavajici: [] },
    odmitnuto: { nove: [], pretrvavajici: [] },
    prehledy: { nove: [], zrusene: [], pretrvavajici: 0 },
    presmerovani: { nove: [] },
  };
}

function novyZaznam(druh, verzePravidel) {
  return {
    druh,
    otiskPotvrzeny: null, otiskPosledni: null,
    verzePravidel,
    etag: null, lastModified: null,
    posledniKontrola: null, posledniOk: null,
    zmena: null, chyba: null, presmerovani: null,
  };
}

/** Má záznam výchozí (potvrzený) stav, se kterým lze porovnávat? */
function maZaklad(z) {
  if (z.druh === 'dostupnost') return z.posledniOk != null;
  return z.otiskPotvrzeny != null || z.odkazyPotvrzene != null;
}

/** Kategorie chyby: odmítnutí (403/429) se počítá zvlášť od nefunkčních odkazů. */
function kategorieChyby(druh) {
  return druh === 'odmitnuto' ? 'odmitnuto' : 'nefunkcni';
}

/**
 * Má stav nějakou nevyřešenou změnu obsahu nebo nevyřešené nové/zrušené odkazy přehledu?
 * Rozhoduje o posunu data v zápatí (pravidlo 10).
 * @param {Record<string, object>} url záznamy stavu
 * @param {Set<string>} ignorovane
 * @param {Set<string>} znameZdroje
 * @returns {boolean}
 */
function maNevyresene(url, ignorovane, znameZdroje) {
  return Object.values(url).some((z) => {
    if (z.druh === 'dostupnost') return false;
    if (z.zmena != null) return true;
    if (!Array.isArray(z.odkazyPotvrzene)) return false;
    const { nove, zrusene } = rozdilOdkazu(z.odkazyPotvrzene, z.odkazyPosledni, ignorovane, znameZdroje);
    return nove.length > 0 || zrusene.length > 0;
  });
}

/** Sleduje se u záznamu množina odkazů (přehled se vzorem odkazů)? */
function sledujeOdkazy(polozka) {
  return polozka.druh === 'prehled' && Boolean(polozka.vzorOdkazu);
}

/**
 * Nové a zrušené odkazy přehledu vůči potvrzenému stavu.
 * @returns {{ nove: string[], zrusene: string[] }}
 */
function rozdilOdkazu(potvrzene, posledni, ignorovane, znameZdroje) {
  const potvrzeneMn = new Set(potvrzene ?? []);
  const posledniMn = new Set(posledni ?? []);
  return {
    nove: [...posledniMn].filter((u) => !potvrzeneMn.has(u) && !ignorovane.has(u) && !znameZdroje.has(u)),
    zrusene: [...potvrzeneMn].filter((u) => !posledniMn.has(u)),
  };
}

/**
 * Vyhodnotí jednu změřenou (nepřeskočenou) URL. Vrací nový záznam, nálezy zapisuje do `nalezy`.
 */
function vyhodnotUrl(adresa, polozka, pred, m, { nalezy, ignorovane, znameZdroje, dnes }) {
  const v = m.vysledek;
  nalezy.zkontrolovano++;
  if (v.beZmeny) nalezy.beZmeny304++;

  const odkazy = sledujeOdkazy(polozka);
  const z = pred ? structuredClone(pred) : novyZaznam(polozka.druh, m.verzePravidel);
  const novy = !pred || !maZaklad(pred);
  const prepocet = !novy && polozka.druh !== 'dostupnost'
    && (pred.druh !== polozka.druh || pred.verzePravidel !== m.verzePravidel);
  z.druh = polozka.druh;
  z.posledniKontrola = dnes;
  if (odkazy) {
    z.odkazyPotvrzene ??= null;
    z.odkazyPosledni ??= null;
  } else {
    delete z.odkazyPotvrzene;
    delete z.odkazyPosledni;
  }
  const polozkaNalezu = { url: adresa, pouziti: polozka.pouziti };

  // Pravidlo 5: chyba. Obsah, validátory (etag, lastModified) ani posledniOk se nemění.
  // Počítají se neúspěchy po sobě v rámci kategorie (nefunkční odkaz / odmítnuto),
  // takže 5xx → timeout je druhý neúspěch. Uloží se poslední druh a status, `od` z prvního.
  if (v.chyba) {
    const { druh } = v.chyba;
    const stejna = z.chyba != null && kategorieChyby(z.chyba.druh) === kategorieChyby(druh);
    const pocet = (stejna ? z.chyba.pocet : 0) + 1;
    const status = v.chyba.status ?? null;
    z.chyba = { druh, status, od: stejna ? z.chyba.od : dnes, pocet };
    if (pocet >= 2) {
      const skupina = druh === 'odmitnuto' ? nalezy.odmitnuto : nalezy.chyby;
      (pocet === 2 ? skupina.nove : skupina.pretrvavajici).push({ ...polozkaNalezu, druh, status });
    }
    // Nevyřešená změna obsahu se v souhrnu dál počítá jako přetrvávající.
    if (z.druh !== 'dostupnost' && z.zmena) nalezy.zmeny.pretrvavajici.push(polozkaNalezu);
    return z;
  }
  z.chyba = null;

  // Přehled se vzorem, u kterého se odkazy nepodařilo změřit (odpověď není HTML): bere se jako
  // neměřený. Odkazy, validátory ani posledniOk se nemění a nic se nehlásí; jinak by se všechny
  // známé kroužky ohlásily jako zrušené.
  if (odkazy && !v.beZmeny && m.odkazy == null) return z;

  // Validátory pro podmíněný požadavek. 304 je nemusí poslat znovu, pak zůstanou uložené.
  if (v.beZmeny) {
    if (v.etag) z.etag = v.etag;
    if (v.lastModified) z.lastModified = v.lastModified;
  } else {
    z.etag = v.etag ?? null;
    z.lastModified = v.lastModified ?? null;
  }

  // Pravidlo 8: trvalé přesměrování. U nově sledované URL se jen uloží jako výchozí stav.
  const presmerovani = v.trvalePresmerovano ? v.konecnaUrl : null;
  if (presmerovani && presmerovani !== z.presmerovani && !novy) {
    nalezy.presmerovani.nove.push({ ...polozkaNalezu, cil: presmerovani });
  }
  z.presmerovani = presmerovani;

  // Dostupnost: žádný otisk, stačí úspěch.
  if (polozka.druh === 'dostupnost') {
    z.otiskPotvrzeny = null;
    z.otiskPosledni = null;
    z.zmena = null;
    z.verzePravidel = m.verzePravidel;
    if (novy) nalezy.noveSledovano++;
    z.posledniOk = dnes;
    return z;
  }

  // Pravidla 1–3: výchozí stav, přepočet po změně pravidel, 304.
  if (v.beZmeny) {
    // 304 nedává nový otisk. Když je potřeba přepočet, smažou se validátory,
    // aby příští běh stáhl celé tělo.
    if (novy || prepocet) {
      z.etag = null;
      z.lastModified = null;
    }
  } else if (novy || prepocet) {
    z.otiskPotvrzeny = m.otisk;
    z.otiskPosledni = m.otisk;
    if (odkazy) {
      z.odkazyPotvrzene = [...(m.odkazy ?? [])];
      z.odkazyPosledni = [...(m.odkazy ?? [])];
    }
    z.zmena = null;
    z.verzePravidel = m.verzePravidel;
    if (novy) nalezy.noveSledovano++;
    else nalezy.prepocitano++;
  } else {
    z.otiskPosledni = m.otisk;
    if (odkazy) z.odkazyPosledni = [...(m.odkazy ?? [])];
  }

  let nevyreseno = false;
  if (odkazy) {
    // Pravidlo 6: přehled se sleduje podle odkazů, změna textu se nehlásí.
    z.zmena = null;
    const { nove, zrusene } = rozdilOdkazu(z.odkazyPotvrzene, z.odkazyPosledni, ignorovane, znameZdroje);
    const minule = new Set(pred?.odkazyPosledni ?? []);
    for (const u of nove) {
      if (minule.has(u)) nalezy.prehledy.pretrvavajici++;
      else nalezy.prehledy.nove.push({ url: u, prehled: adresa });
    }
    for (const u of zrusene) {
      if (pred?.odkazyPosledni && !minule.has(u)) nalezy.prehledy.pretrvavajici++;
      else nalezy.prehledy.zrusene.push({ url: u, prehled: adresa });
    }
    if (nove.length === 0 && zrusene.length === 0) z.odkazyPotvrzene = [...(z.odkazyPosledni ?? [])];
    else nevyreseno = true;
  } else {
    // Pravidlo 4: změna otisku proti potvrzenému.
    const otisk = z.otiskPosledni;
    if (otisk === z.otiskPotvrzeny) {
      z.zmena = null;
    } else if (pred?.zmena?.otisk === otisk) {
      nalezy.zmeny.pretrvavajici.push(polozkaNalezu);
    } else {
      z.zmena = { od: pred?.zmena?.od ?? dnes, otisk };
      nalezy.zmeny.nove.push(polozkaNalezu);
    }
  }

  // Pravidlo 7.
  if (z.zmena === null && !nevyreseno) z.posledniOk = dnes;
  return z;
}

/**
 * Vyhodnotí běh monitoringu. Čistá funkce: `predchozi` nemění, výstup s ním nesdílí objekty.
 * @param {{ predchozi: object, seznam: Map<string, { druh: string, pouziti: {id: string, pole: string}[], vzorOdkazu?: string }>,
 *   mereni: Map<string, { vysledek: object|null, otisk: string|null, odkazy: string[]|null, verzePravidel: string, preskoceno: null|'robots'|'robots-nedostupny' }>,
 *   ignorovane: string[], znameZdroje: Set<string>, dnes: string }} vstup
 * @returns {{ stav: object, nalezy: object }}
 */
export function vyhodnotBeh({ predchozi, seznam, mereni, ignorovane = [], znameZdroje = new Set(), dnes }) {
  const nalezy = prazdneNalezy();
  const kontext = { nalezy, ignorovane: new Set(ignorovane), znameZdroje, dnes };
  const url = {};

  // Pravidlo 9: projdou se jen URL ze seznamu, ostatní ze stavu vypadnou. Klíče seřazené.
  for (const adresa of [...seznam.keys()].sort()) {
    const polozka = seznam.get(adresa);
    const pred = predchozi.url[adresa];
    const m = mereni.get(adresa);

    if (m?.preskoceno) {
      // Pravidlo 11.
      nalezy.preskoceno.push({ url: adresa, duvod: m.preskoceno });
      if (pred) url[adresa] = { ...structuredClone(pred), posledniKontrola: dnes };
      continue;
    }
    if (!m?.vysledek) {
      // Neměřeno (nemělo by nastat): záznam zůstane, jak byl.
      if (pred) url[adresa] = structuredClone(pred);
      continue;
    }
    url[adresa] = vyhodnotUrl(adresa, polozka, pred, m, kontext);
  }

  // Pravidlo 10: datum v zápatí jen bez nevyřešených změn obsahu a odkazů.
  const stav = {
    verze: 1,
    posledniBeh: dnes,
    zapatiDatum: maNevyresene(url, kontext.ignorovane, znameZdroje) ? predchozi.zapatiDatum : dnes,
    url,
  };
  return { stav, nalezy };
}

/**
 * Potvrdí poslední stav URL (agent vyřešil issue): poslední otisk a odkazy se stanou potvrzenými.
 * `posledniOk` se posune jen u URL bez chyby, která má změřený stav (u obsahu/přehledu otisk).
 * Když po potvrzení nezůstane nic nevyřešeného, posune se i `zapatiDatum`.
 * Vstup nemění. URL, které ve stavu nejsou, se ignorují.
 * @param {object} stav
 * @param {string[] | 'vse'} urls
 * @param {string} dnes YYYY-MM-DD
 * @param {{ ignorovane?: string[], znameZdroje?: Set<string> }} [moznosti] pro vyhodnocení nevyřešených odkazů přehledů
 * @returns {object} nový stav
 */
export function potvrd(stav, urls, dnes, { ignorovane = [], znameZdroje = new Set() } = {}) {
  const novy = structuredClone(stav);
  const cile = urls === 'vse' ? Object.keys(novy.url) : urls;
  for (const adresa of cile) {
    const z = novy.url[adresa];
    if (!z) continue;
    z.otiskPotvrzeny = z.otiskPosledni;
    if ('odkazyPosledni' in z) z.odkazyPotvrzene = z.odkazyPosledni === null ? null : [...z.odkazyPosledni];
    z.zmena = null;
    const zmereno = z.druh === 'dostupnost' || z.otiskPosledni != null;
    if (!z.chyba && zmereno) z.posledniOk = dnes;
  }
  if (!maNevyresene(novy.url, new Set(ignorovane), znameZdroje)) novy.zapatiDatum = dnes;
  return novy;
}

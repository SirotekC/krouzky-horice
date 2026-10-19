// Vykreslení karet aktivit a stavů stránky. Texty z dat se vkládají jen přes
// `textContent`, nikdy přes `innerHTML`. DOM se používá až uvnitř funkcí.

import { CHYBA_URL, REPO_URL } from './config.js';
import { KATEGORIE, POHLAVI } from './data.js';
import { cisloDne, formatDatum, formatObdobi, stavPrihlasky } from './registration.js';
import { odkazNaAktivitu } from './url-state.js';

const ZASTARALE_DNI = 90;
const POTVRZENI_MS = 2500;

const DNY = { po: 'Po', ut: 'Út', st: 'St', ct: 'Čt', pa: 'Pá', so: 'So', ne: 'Ne' };
const DNY_CELE = { po: 'Pondělí', ut: 'Úterý', st: 'Středa', ct: 'Čtvrtek', pa: 'Pátek', so: 'Sobota', ne: 'Neděle' };
/** Celé názvy dnů ve volném textu (např. „Úterý“, „středa“), které se zvýrazní tučně. */
const VZOR_DNU = /(pondělí|úterý|středa|středu|čtvrtek|pátek|sobota|sobotu|neděle|neděli)/giu;

/** Vytvoří element s třídou a textem. */
export function el(tag, { trida, text, atributy } = {}, ...deti) {
  const prvek = document.createElement(tag);
  if (trida) prvek.className = trida;
  if (text != null) prvek.textContent = text;
  if (atributy) for (const [k, v] of Object.entries(atributy)) prvek.setAttribute(k, v);
  prvek.append(...deti.filter(Boolean));
  return prvek;
}

/** Externí odkaz otevíraný v novém panelu. */
export function externiOdkaz(href, text, trida) {
  return el('a', { trida, text, atributy: { href, target: '_blank', rel: 'noopener' } });
}

function slovoLet(n, pad) {
  // pad: 'nom' pro „7–18 let / 2 roky“, 'gen' pro „od 1 roku / od 5 let“
  if (n === 1) return pad === 'gen' ? 'roku' : 'rok';
  if (pad === 'nom' && n >= 2 && n <= 4) return 'roky';
  return 'let';
}

/** „7–18 let“, „od 5 let“, „do 12 let“, nebo `null`. */
export function textVeku(vekOd, vekDo) {
  const maOd = Number.isInteger(vekOd);
  const maDo = Number.isInteger(vekDo);
  if (maOd && maDo) {
    return vekOd === vekDo ? `${vekOd} ${slovoLet(vekOd, 'nom')}` : `${vekOd}–${vekDo} ${slovoLet(vekDo, 'nom')}`;
  }
  if (maOd) return `od ${vekOd} ${slovoLet(vekOd, 'gen')}`;
  if (maDo) return `do ${vekDo} ${slovoLet(vekDo, 'gen')}`;
  return null;
}

function textMista(misto) {
  if (!misto) return null;
  return [misto.nazev, misto.adresa].filter(Boolean).join(', ') || null;
}

/** Rozdělí řádky rozvrhu do po sobě jdoucích bloků se stejnou skupinou. */
function blokySkupin(rozvrh) {
  const bloky = [];
  for (const radek of rozvrh) {
    const posledni = bloky.at(-1);
    if (posledni && posledni.skupina === (radek.skupina ?? null)) posledni.radky.push(radek);
    else bloky.push({ skupina: radek.skupina ?? null, radky: [radek] });
  }
  return bloky;
}

function seznamDnu(radky) {
  return el(
    'ul',
    { trida: 'rozvrh__dny' },
    ...radky.map((r) =>
      el(
        'li',
        { trida: 'rozvrh__den' },
        el('strong', { text: DNY_CELE[r.den] ?? r.den }),
        el(
          'span',
          {},
          r.casy?.length ? r.casy.join(' nebo ') : null,
          r.misto ? el('span', { trida: 'rozvrh__misto', text: r.casy?.length ? ` · ${r.misto}` : r.misto }) : null,
        ),
      ),
    ),
  );
}

/** Volný text s celými názvy dnů zvýrazněnými tučně. */
function textSeZvyraznenymiDny(text) {
  const p = el('p', { trida: 'rozvrh__text' });
  for (const [i, cast] of text.split(VZOR_DNU).entries()) {
    if (cast) p.append(i % 2 ? el('strong', { text: cast }) : cast);
  }
  return p;
}

/** Obsah údaje „Kdy“: strukturovaný rozvrh, nebo volný text. */
function obsahTerminu(terminy) {
  if (!terminy) return null;
  const casti = [];
  if (terminy.rozvrh?.length) {
    for (const blok of blokySkupin(terminy.rozvrh)) {
      if (blok.skupina) {
        casti.push(el('div', { trida: 'rozvrh__skupina' }, el('p', { text: blok.skupina }), seznamDnu(blok.radky)));
      } else {
        casti.push(seznamDnu(blok.radky));
      }
    }
  } else if (terminy.text) {
    casti.push(textSeZvyraznenymiDny(terminy.text));
  } else if (terminy.dny?.length) {
    casti.push(el('p', { text: terminy.dny.map((d) => DNY[d] ?? d).join(', ') }));
  }
  if (!casti.length) return null;
  if (Array.isArray(terminy.obdobi)) {
    casti.push(
      el(
        'ul',
        { trida: 'rozvrh__obdobi' },
        ...terminy.obdobi.map((o) =>
          el('li', { trida: 'rozvrh__den' }, el('strong', { text: o.nazev }), el('span', { text: o.termin })),
        ),
      ),
    );
  } else if (terminy.obdobi) {
    casti.push(el('p', { trida: 'rozvrh__doplnek', text: terminy.obdobi }));
  }
  if (terminy.poznamka) casti.push(el('p', { trida: 'rozvrh__doplnek', text: terminy.poznamka }));
  return el('div', { trida: 'rozvrh' }, ...casti);
}

function textCeny(cena) {
  if (!cena) return null;
  if (cena.text) return cena.text;
  if (cena.obdobi === 'zdarma') return 'Zdarma';
  if (cena.castka_kc != null) return `${cena.castka_kc.toLocaleString('cs-CZ')} Kč`;
  return null;
}

/** Doména bez `www.` pro patičku karty. */
export function domena(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Tvar slova podle počtu: `tvary` = [1, 2–4, 5 a víc], např. ['kroužek', 'kroužky', 'kroužků']. */
export function sklonuj(n, [jeden, dva, pet]) {
  if (n === 1) return jeden;
  if (n >= 2 && n <= 4) return dva;
  return pet;
}

/** „1 kroužek“, „3 kroužky“, „12 kroužků“. */
export function pocetKrouzku(n) {
  return `${n} ${sklonuj(n, ['kroužek', 'kroužky', 'kroužků'])}`;
}

/** Řádek „93 kroužků · 12 zaměření · 10 organizací“ s čísly zvýrazněnými tučně. */
export function radekStatistik({ krouzky, kategorie, organizace }) {
  const polozky = [
    [krouzky, ['kroužek', 'kroužky', 'kroužků']],
    [kategorie, ['zaměření', 'zaměření', 'zaměření']],
    [organizace, ['organizace', 'organizace', 'organizací']],
  ];
  const casti = [];
  for (const [n, tvary] of polozky) {
    if (casti.length) casti.push(' · ');
    casti.push(el('strong', { text: String(n) }), ` ${sklonuj(n, tvary)}`);
  }
  return casti;
}

function udaj(nazev, hodnota) {
  if (!hodnota) return null;
  const dd = typeof hodnota === 'string' ? el('dd', { text: hodnota }) : el('dd', {}, hodnota);
  return el('div', { trida: 'udaje__radek' }, el('dt', { text: nazev }), dd);
}

/** Vykreslí kartu jedné aktivity. */
export function kartaAktivity(a, dnes) {
  const stav = stavPrihlasky(a.prihlaska, dnes);
  const p = a.prihlaska;

  const hlavicka = el(
    'header',
    { trida: 'karta__hlavicka' },
    el('h3', { trida: 'karta__nazev' }, el('a', { text: a.nazev, atributy: { href: odkazNaAktivitu(a.id) } })),
    el('p', { trida: 'karta__organizace', text: a.organizace?.nazev ?? a.organizace_id }),
    el('p', { trida: `stav stav--${stav.stav}` }, el('span', { trida: 'jen-ctecka', text: 'Stav přihlášek: ' }), stav.text),
  );

  const stitky = el('ul', { trida: 'stitky', atributy: { 'aria-label': 'Kategorie' } });
  for (const k of a.kategorie) stitky.append(el('li', { trida: 'stitek', text: KATEGORIE[k] ?? k }));

  const radky = [
    udaj('Věk', textVeku(a.vek_od, a.vek_do)),
    udaj('Pro', POHLAVI[a.pohlavi] ?? null),
    udaj('Místo', textMista(a.misto)),
    udaj('Kdy', obsahTerminu(a.terminy)),
    udaj('Cena', textCeny(a.cena)),
  ].filter(Boolean);
  const udaje = radky.length ? el('dl', { trida: 'udaje' }, ...radky) : null;

  const popis = a.popis ? el('p', { trida: 'karta__popis', text: a.popis }) : null;

  const obdobi = formatObdobi(p.od, p.do);
  const prihlaska = el(
    'div',
    { trida: 'prihlaska' },
    el('h4', { trida: 'prihlaska__nadpis', text: 'Jak se přihlásit' }),
    el('p', { text: p.zpusob }),
    obdobi ? el('p', {}, el('strong', { text: 'Přihlášky: ' }), obdobi) : null,
    p.poznamka ? el('p', { trida: 'prihlaska__poznamka', text: p.poznamka }) : null,
    externiOdkaz(p.odkaz || a.zdroj_url, 'Přihláška / více informací', 'tlacitko'),
  );

  const stari = cisloDne(dnes) - cisloDne(a.overeno);
  const paticka = el(
    'footer',
    { trida: 'karta__paticka' },
    el('span', {}, 'Zdroj: ', externiOdkaz(a.zdroj_url, domena(a.zdroj_url))),
    el('span', { text: `Ověřeno ${formatDatum(a.overeno)}` }),
    stari > ZASTARALE_DNI ? el('span', { trida: 'zastarale', text: 'Údaje mohou být zastaralé' }) : null,
    tlacitkoSdilet(a),
  );

  return el(
    'article',
    { trida: `karta karta--${stav.stav}`, atributy: { id: `aktivita-${a.id}` } },
    hlavicka,
    stitky,
    popis,
    udaje,
    prihlaska,
    paticka,
  );
}

/** Úplná adresa detailu aktivity bez filtrů, např. `https://…/krouzky-horice/#/aktivita/{id}`. */
function adresaAktivity(id) {
  return `${window.location.origin}${window.location.pathname}${odkazNaAktivitu(id)}`;
}

/**
 * Tlačítko pro sdílení odkazu na aktivitu. Na mobilu otevře systémové sdílení,
 * jinde odkaz zkopíruje do schránky. Když nejde ani jedno, otevře detail, aby šel
 * odkaz zkopírovat z adresního řádku.
 */
function tlacitkoSdilet(a) {
  const popisek = 'Sdílet odkaz';
  const tlacitko = el('button', {
    trida: 'sdilet',
    text: popisek,
    atributy: { type: 'button', 'aria-label': `Sdílet odkaz na kroužek ${a.nazev}` },
  });
  const potvrd = (text) => {
    tlacitko.textContent = text;
    setTimeout(() => {
      tlacitko.textContent = popisek;
    }, POTVRZENI_MS);
  };
  tlacitko.addEventListener('click', async () => {
    const url = adresaAktivity(a.id);
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: `${a.nazev} – Kroužky Hořice`, url });
        return;
      } catch (chyba) {
        // Uživatel sdílení zavřel.
        if (chyba?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      potvrd('Odkaz zkopírován');
    } catch {
      window.location.hash = odkazNaAktivitu(a.id);
    }
  });
  return tlacitko;
}

/** Detail jedné aktivity s odkazem zpět na seznam. */
export function detailAktivity(a, dnes, odkazZpet) {
  return el('div', { trida: 'detail' }, odkazZpet, kartaAktivity(a, dnes));
}

/** Stav pro odkaz na aktivitu, která neexistuje (např. byla smazána). */
export function nenalezenaAktivita(odkazZpet) {
  return el(
    'div',
    { trida: 'detail' },
    odkazZpet,
    el(
      'div',
      { trida: 'stav-stranky' },
      el('p', { text: 'Tento kroužek jsme nenašli. Možná už se nekoná nebo se změnil odkaz.' }),
    ),
  );
}

/** Seznam karet. */
export function seznamKaret(aktivity, dnes) {
  const seznam = el('ul', { trida: 'karty' });
  for (const a of aktivity) seznam.append(el('li', {}, kartaAktivity(a, dnes)));
  return seznam;
}

/** Zobrazí odkazy `[data-odkaz="repo|chyba"]`, pokud jsou adresy nastavené v config.js. */
export function nastavOdkazy() {
  for (const [klic, url] of [['repo', REPO_URL], ['chyba', CHYBA_URL]]) {
    if (!url) continue;
    for (const odkaz of document.querySelectorAll(`[data-odkaz="${klic}"]`)) {
      odkaz.href = url;
      // E-mailový odkaz otevře poštovního klienta, nový panel nedává smysl.
      if (!url.startsWith('mailto:')) {
        odkaz.target = '_blank';
        odkaz.rel = 'noopener';
      }
      odkaz.hidden = false;
    }
  }
}

/** Prázdný stav s tlačítkem pro zrušení filtrů. */
export function prazdnyStav(naZruseni) {
  const tlacitko = el('button', { trida: 'tlacitko', text: 'Zrušit filtry', atributy: { type: 'button' } });
  tlacitko.addEventListener('click', naZruseni);
  return el('div', { trida: 'stav-stranky' }, el('p', { text: 'Žádný kroužek neodpovídá filtrům.' }), tlacitko);
}

/** Chybový stav při selhání načtení dat. */
export function chybovyStav() {
  return el(
    'div',
    { trida: 'stav-stranky stav-stranky--chyba', atributy: { role: 'alert' } },
    el('p', { text: 'Nepodařilo se načíst seznam kroužků. Zkontrolujte připojení k internetu a zkuste to znovu.' }),
    el('a', { trida: 'tlacitko', text: 'Načíst stránku znovu', atributy: { href: '' } }),
  );
}

// Vykreslení karet aktivit a stavů stránky. Texty z dat se vkládají jen přes
// `textContent`, nikdy přes `innerHTML`. DOM se používá až uvnitř funkcí.

import { CHYBA_URL, REPO_URL } from './config.js';
import { KATEGORIE, POHLAVI } from './data.js';
import { cisloDne, formatDatum, formatObdobi, stavPrihlasky } from './registration.js';

const ZASTARALE_DNI = 90;

const DNY = { po: 'Po', ut: 'Út', st: 'St', ct: 'Čt', pa: 'Pá', so: 'So', ne: 'Ne' };

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

function textTerminu(terminy) {
  if (!terminy) return null;
  if (terminy.text) return terminy.text;
  if (terminy.dny?.length) return terminy.dny.map((d) => DNY[d] ?? d).join(', ');
  return null;
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

/** „1 kroužek“, „3 kroužky“, „12 kroužků“. */
export function pocetKrouzku(n) {
  if (n === 1) return '1 kroužek';
  if (n >= 2 && n <= 4) return `${n} kroužky`;
  return `${n} kroužků`;
}

function udaj(nazev, hodnota) {
  if (!hodnota) return null;
  return el('div', { trida: 'udaje__radek' }, el('dt', { text: nazev }), el('dd', { text: hodnota }));
}

/** Vykreslí kartu jedné aktivity. */
export function kartaAktivity(a, dnes) {
  const stav = stavPrihlasky(a.prihlaska, dnes);
  const p = a.prihlaska;

  const hlavicka = el(
    'header',
    { trida: 'karta__hlavicka' },
    el('h3', { trida: 'karta__nazev', text: a.nazev }),
    el('p', { trida: 'karta__organizace', text: a.organizace?.nazev ?? a.organizace_id }),
    el('p', { trida: `stav stav--${stav.stav}` }, el('span', { trida: 'jen-ctecka', text: 'Stav přihlášek: ' }), stav.text),
  );

  const stitky = el('ul', { trida: 'stitky', atributy: { 'aria-label': 'Kategorie' } });
  for (const k of a.kategorie) stitky.append(el('li', { trida: 'stitek', text: KATEGORIE[k] ?? k }));

  const radky = [
    udaj('Věk', textVeku(a.vek_od, a.vek_do)),
    udaj('Pro', POHLAVI[a.pohlavi] ?? null),
    udaj('Místo', textMista(a.misto)),
    udaj('Kdy', textTerminu(a.terminy)),
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
      odkaz.target = '_blank';
      odkaz.rel = 'noopener';
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

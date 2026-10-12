// Vstupní bod: načtení dat, napojení filtrů a překreslení výsledků.

import { KATEGORIE, nactiData } from './data.js';
import { POHLAVI_FILTRU, STAVY_FILTRU, filtruj, prazdneFiltry, seradi } from './filters.js';
import { dnesPraha, formatDatum } from './registration.js';
import { chybovyStav, el, nastavOdkazy, pocetKrouzku, prazdnyStav, seznamKaret } from './render.js';
import { filtryDoUrl, filtryZUrl } from './url-state.js';

const DEBOUNCE_MS = 150;
const DESKTOP = '(min-width: 900px)';

const $ = (selektor) => document.querySelector(selektor);

function sbalitelneFiltry() {
  const panel = $('#filtry-panel');
  const dotaz = window.matchMedia(DESKTOP);
  const nastav = () => {
    if (dotaz.matches) panel.open = true;
  };
  nastav();
  dotaz.addEventListener('change', nastav);
  // Na desktopu jsou filtry vždy rozbalené.
  panel.addEventListener('toggle', nastav);
}

function naplnFormular(data) {
  const chipy = $('#f-kat');
  for (const [klic, popisek] of Object.entries(KATEGORIE)) {
    // Nabízet jen kategorie, které v datech opravdu jsou.
    if (!data.aktivity.some((a) => a.kategorie.includes(klic))) continue;
    const vstup = el('input', { atributy: { type: 'checkbox', name: 'kat', value: klic } });
    chipy.append(el('label', { trida: 'chip' }, vstup, el('span', { text: popisek })));
  }

  const porovnej = new Intl.Collator('cs').compare;
  const select = $('#f-org');
  for (const o of [...data.organizace].sort((a, b) => porovnej(a.nazev, b.nazev))) {
    select.append(el('option', { text: o.nazev, atributy: { value: o.id } }));
  }

  const pohlavi = $('#f-pohlavi');
  for (const [klic, popisek] of Object.entries(POHLAVI_FILTRU)) {
    pohlavi.append(el('option', { text: popisek, atributy: { value: klic } }));
  }

  const stav = $('#f-stav');
  for (const [klic, popisek] of Object.entries(STAVY_FILTRU)) {
    stav.append(el('option', { text: popisek, atributy: { value: klic } }));
  }
}

function zapisDoFormulare(form, filtry) {
  form.q.value = filtry.q;
  form.vek.value = filtry.vek ?? '';
  for (const vstup of form.querySelectorAll('input[name="kat"]')) vstup.checked = filtry.kat.includes(vstup.value);
  form.org.value = filtry.org;
  form.stav.value = filtry.stav;
  form.pohlavi.value = filtry.pohlavi;
}

function prectiFormular(form) {
  const vek = form.vek.value.trim();
  const vekCislo = Number(vek);
  return {
    q: form.q.value.trim(),
    vek: vek !== '' && Number.isInteger(vekCislo) && vekCislo >= 0 && vekCislo <= 26 ? vekCislo : null,
    kat: [...form.querySelectorAll('input[name="kat"]:checked')].map((v) => v.value),
    org: form.org.value,
    stav: form.stav.value,
    pohlavi: form.pohlavi.value,
  };
}

function debounce(fn, ms) {
  let casovac;
  return (...args) => {
    clearTimeout(casovac);
    casovac = setTimeout(() => fn(...args), ms);
  };
}

async function spust() {
  nastavOdkazy();
  sbalitelneFiltry();

  const seznam = $('#seznam');
  const pocet = $('#pocet');
  const form = $('#filtry');

  let data;
  try {
    data = await nactiData();
  } catch (chyba) {
    console.error(chyba);
    pocet.textContent = '';
    seznam.replaceChildren(chybovyStav());
    return;
  }

  const dnes = dnesPraha();
  const kontext = { dnes, kategorie: KATEGORIE };
  $('#aktualizovano').textContent = `Data aktualizována ${formatDatum(data.meta.aktualizovano)}.`;

  naplnFormular(data);
  let filtry = filtryZUrl(window.location.search, data.organizace.map((o) => o.id));
  zapisDoFormulare(form, filtry);

  const prekresli = () => {
    const vysledky = seradi(filtruj(data.aktivity, filtry, kontext), dnes);
    if (vysledky.length) {
      pocet.textContent = `Nalezeno ${pocetKrouzku(vysledky.length)}`;
      seznam.replaceChildren(seznamKaret(vysledky, dnes));
    } else {
      pocet.textContent = 'Nalezeno 0 kroužků';
      seznam.replaceChildren(prazdnyStav(zrusFiltry));
    }
  };

  const aktualizuj = () => {
    filtry = prectiFormular(form);
    const query = filtryDoUrl(filtry);
    window.history.replaceState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
    prekresli();
  };

  function zrusFiltry() {
    filtry = prazdneFiltry();
    zapisDoFormulare(form, filtry);
    aktualizuj();
    form.q.focus();
  }

  const aktualizujSOdkladem = debounce(aktualizuj, DEBOUNCE_MS);
  form.addEventListener('input', (e) => (e.target.name === 'q' ? aktualizujSOdkladem() : aktualizuj()));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    aktualizuj();
  });
  form.addEventListener('reset', (e) => {
    e.preventDefault();
    zrusFiltry();
  });

  prekresli();
}

spust();

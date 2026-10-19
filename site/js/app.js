// Vstupní bod: načtení dat, napojení filtrů a překreslení výsledků.

import { KATEGORIE, SKUPINY_KATEGORII, nactiData } from './data.js';
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

function chip(typ, jmeno, hodnota, popisek) {
  const vstup = el('input', { atributy: { type: typ, name: jmeno, value: hodnota } });
  return el('label', { trida: 'chip' }, vstup, el('span', { text: popisek }));
}

/** Skupiny zaměření se vykreslí ještě před načtením dat, aby filtry pod nimi neposkočily. */
function vykresliSkupiny() {
  const skupiny = $('#f-skup');
  skupiny.append(chip('radio', 'skup', '', 'Vše'));
  for (const [klic, skupina] of Object.entries(SKUPINY_KATEGORII)) {
    skupiny.append(chip('radio', 'skup', klic, skupina.popisek));
  }
}

function naplnFormular(data) {
  // Nabízet jen skupiny a kategorie, které v datech opravdu jsou.
  const pouzite = new Set(data.aktivity.flatMap((a) => a.kategorie));
  const podkategorie = $('#f-kat');
  for (const [klic, skupina] of Object.entries(SKUPINY_KATEGORII)) {
    const kategorie = skupina.kategorie.filter((k) => pouzite.has(k));
    if (!kategorie.length) {
      $(`#f-skup input[value="${klic}"]`).closest('.chip').remove();
      continue;
    }
    // Upřesnění má smysl, jen když skupina obsahuje víc kategorií.
    if (kategorie.length < 2) continue;
    for (const k of kategorie) {
      const stitek = chip('checkbox', 'kat', k, KATEGORIE[k]);
      stitek.dataset.skupina = klic;
      podkategorie.append(stitek);
    }
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
  const skupiny = [...form.querySelectorAll('input[name="skup"]')];
  // Skupina, která v datech není, se zobrazí jako „Vše“.
  const vybrana = skupiny.find((v) => v.value === filtry.skup) ?? skupiny[0];
  for (const vstup of skupiny) vstup.checked = vstup === vybrana;
  for (const vstup of form.querySelectorAll('input[name="kat"]')) vstup.checked = filtry.kat.includes(vstup.value);
  zobrazPodkategorie(form);
  form.org.value = filtry.org;
  form.stav.value = filtry.stav;
  form.pohlavi.value = filtry.pohlavi;
}

function vybranaSkupina(form) {
  return form.querySelector('input[name="skup"]:checked')?.value ?? '';
}

/** Ukáže jen podkategorie vybrané skupiny; bez nich skryje celý řádek. */
function zobrazPodkategorie(form) {
  const skup = vybranaSkupina(form);
  let viditelne = 0;
  for (const stitek of $('#f-kat').children) {
    stitek.hidden = stitek.dataset.skupina !== skup;
    if (!stitek.hidden) viditelne++;
  }
  $('#f-kat').hidden = viditelne === 0;
}

function prectiFormular(form) {
  const vek = form.vek.value.trim();
  const vekCislo = Number(vek);
  return {
    q: form.q.value.trim(),
    vek: vek !== '' && Number.isInteger(vekCislo) && vekCislo >= 0 && vekCislo <= 26 ? vekCislo : null,
    skup: vybranaSkupina(form),
    kat: [...form.querySelectorAll('input[name="kat"]:checked')]
      .filter((v) => v.closest('.chip').dataset.skupina === vybranaSkupina(form))
      .map((v) => v.value),
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
  vykresliSkupiny();

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
  zapisDoFormulare(form, filtryZUrl(window.location.search, data.organizace.map((o) => o.id)));
  // Filtry bereme z formuláře, aby odpovídaly tomu, co je vidět (např. skupina, která v datech není).
  let filtry = prectiFormular(form);

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
  form.addEventListener('input', (e) => {
    if (e.target.name === 'q') return aktualizujSOdkladem();
    if (e.target.name === 'skup') {
      // Nová skupina začíná bez upřesnění.
      for (const vstup of form.querySelectorAll('input[name="kat"]')) vstup.checked = false;
      zobrazPodkategorie(form);
    }
    aktualizuj();
  });
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

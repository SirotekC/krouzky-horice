// Vstupní bod: načtení dat, napojení filtrů a překreslení výsledků.

import { KATEGORIE, SKUPINY_KATEGORII, nactiData, statistiky } from './data.js';
import { DNY_FILTRU, POHLAVI_FILTRU, STAVY_FILTRU, filtruj, jsouPrazdne, prazdneFiltry, seradi } from './filters.js';
import { dnesPraha, formatDatum } from './registration.js';
import {
  chybovyStav,
  detailAktivity,
  el,
  nastavOdkazy,
  nenalezenaAktivita,
  pocetKrouzku,
  prazdnyStav,
  radekStatistik,
  seznamKaret,
} from './render.js';
import { cestaZHashe, filtryDoUrl, filtryZUrl } from './url-state.js';

const DEBOUNCE_MS = 150;
const DESKTOP = '(min-width: 900px)';

const $ = (selektor) => document.querySelector(selektor);
const TITULEK = document.title;

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

/**
 * Dny a skupiny zaměření se vykreslí ještě před načtením dat, aby filtry pod nimi neposkočily.
 * Skupin lze vybrat víc; „Vše“ není samostatná hodnota, jen svítí, když není vybraná žádná skupina.
 */
function vykresliChipy() {
  $('#f-dny').append(...Object.entries(DNY_FILTRU).map(([klic, popisek]) => chip('checkbox', 'den', klic, popisek)));
  const skupiny = $('#f-skup');
  skupiny.append(chip('checkbox', 'vse', '', 'Vše'));
  for (const [klic, skupina] of Object.entries(SKUPINY_KATEGORII)) {
    skupiny.append(chip('checkbox', 'skup', klic, skupina.popisek));
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
    const radek = el(
      'div',
      { trida: 'chipy chipy--pod', atributy: { role: 'group', 'aria-label': `Upřesnit: ${skupina.popisek}` } },
      el('span', { trida: 'chipy__nadpis', text: skupina.popisek }),
      ...kategorie.map((k) => chip('checkbox', 'kat', k, KATEGORIE[k])),
    );
    radek.dataset.skupina = klic;
    radek.hidden = true;
    podkategorie.append(radek);
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
  for (const vstup of form.querySelectorAll('input[name="den"]')) vstup.checked = filtry.dny.includes(vstup.value);
  // Skupina, která v datech není, se ignoruje.
  for (const vstup of form.querySelectorAll('input[name="skup"]')) vstup.checked = filtry.skup.includes(vstup.value);
  for (const vstup of form.querySelectorAll('input[name="kat"]')) vstup.checked = filtry.kat.includes(vstup.value);
  zobrazPodkategorie(form);
  form.org.value = filtry.org;
  form.stav.value = filtry.stav;
  form.pohlavi.value = filtry.pohlavi;
}

function vybraneSkupiny(form) {
  return [...form.querySelectorAll('input[name="skup"]:checked')].map((v) => v.value);
}

/**
 * Ukáže řádky podkategorií jen u vybraných skupin; podkategorie skrytých řádků odškrtne,
 * aby se po novém výběru skupina zobrazila celá. Nastaví také chip „Vše“.
 */
function zobrazPodkategorie(form) {
  const skup = vybraneSkupiny(form);
  let viditelne = 0;
  for (const radek of $('#f-kat').children) {
    radek.hidden = !skup.includes(radek.dataset.skupina);
    if (radek.hidden) for (const vstup of radek.querySelectorAll('input')) vstup.checked = false;
    else viditelne++;
  }
  $('#f-kat').hidden = viditelne === 0;
  form.vse.checked = skup.length === 0;
}

function prectiFormular(form) {
  const vek = form.vek.value.trim();
  const vekCislo = Number(vek);
  return {
    q: form.q.value.trim(),
    vek: vek !== '' && Number.isInteger(vekCislo) && vekCislo >= 0 && vekCislo <= 26 ? vekCislo : null,
    dny: [...form.querySelectorAll('input[name="den"]:checked')].map((v) => v.value),
    skup: vybraneSkupiny(form),
    kat: [...form.querySelectorAll('input[name="kat"]:checked')].map((v) => v.value),
    org: form.org.value,
    stav: form.stav.value,
    pohlavi: form.pohlavi.value,
  };
}

/** Počet aktivních filtrů ve sbalené části (bez hledání, které je vidět vždy). */
function oznacAktivniFiltry(form, filtry) {
  const pocet = [filtry.vek != null, filtry.dny.length, filtry.pohlavi, filtry.skup.length, filtry.org, filtry.stav].filter(Boolean).length;
  $('#filtry-pocet').textContent = pocet ? String(pocet) : '';
  $('#filtry-pocet').title = pocet ? `Aktivní filtry: ${pocet}` : '';
  form.classList.toggle('filtry__panel--prazdne', jsouPrazdne(filtry));
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
  vykresliChipy();

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
  $('#statistiky').replaceChildren(...radekStatistik(statistiky(data.aktivity)));

  naplnFormular(data);
  zapisDoFormulare(form, filtryZUrl(window.location.search, data.organizace.map((o) => o.id)));
  // Filtry bereme z formuláře, aby odpovídaly tomu, co je vidět (např. skupina, která v datech není).
  let filtry = prectiFormular(form);

  const rozvrzeni = $('.rozvrzeni');
  let cesta = cestaZHashe(window.location.hash) ?? { typ: 'seznam' };

  /** Odkaz zpět na seznam; zachová filtry z URL a posune se na kartu, ze které uživatel přišel. */
  const odkazZpet = (id) => {
    const odkaz = el('a', {
      trida: 'detail__zpet',
      text: '← Všechny kroužky',
      atributy: { href: `${window.location.pathname}${window.location.search}` },
    });
    odkaz.addEventListener('click', (e) => {
      e.preventDefault();
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
      cesta = { typ: 'seznam' };
      prekresli();
      const karta = id && document.getElementById(`aktivita-${id}`);
      if (karta) karta.scrollIntoView({ block: 'center' });
      else window.scrollTo(0, 0);
      (karta?.querySelector('.karta__nazev a') ?? $('#vysledky')).focus({ preventScroll: true });
    });
    return odkaz;
  };

  const vykresliDetail = () => {
    const aktivita = data.aktivity.find((a) => a.id === cesta.id);
    rozvrzeni.classList.add('rozvrzeni--detail');
    pocet.textContent = '';
    if (aktivita) {
      document.title = `${aktivita.nazev} – Kroužky Hořice`;
      seznam.replaceChildren(detailAktivity(aktivita, dnes, odkazZpet(aktivita.id)));
    } else {
      document.title = `Kroužek nenalezen – Kroužky Hořice`;
      seznam.replaceChildren(nenalezenaAktivita(odkazZpet(null)));
    }
  };

  const prekresli = () => {
    oznacAktivniFiltry(form, filtry);
    if (cesta.typ === 'aktivita') return vykresliDetail();
    rozvrzeni.classList.remove('rozvrzeni--detail');
    document.title = TITULEK;
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
    if (e.target.name === 'vse') {
      // „Vše“ zruší výběr skupin; odškrtnout samo o sobě nejde.
      for (const vstup of form.querySelectorAll('input[name="skup"]')) vstup.checked = false;
    }
    if (e.target.name === 'vse' || e.target.name === 'skup') zobrazPodkategorie(form);
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

  window.addEventListener('hashchange', () => {
    const nova = cestaZHashe(window.location.hash);
    // Ostatní kotvy (např. „Přeskočit na výsledky“) zobrazení nemění.
    if (!nova) return;
    cesta = nova;
    prekresli();
    if (cesta.typ === 'aktivita') {
      window.scrollTo(0, 0);
      $('#vysledky').focus({ preventScroll: true });
    }
  });
  // Tlačítko zpět v prohlížeči po návratu na seznam přes „← Všechny kroužky“.
  window.addEventListener('popstate', () => {
    const nova = cestaZHashe(window.location.hash);
    if (!nova || (nova.typ === cesta.typ && nova.id === cesta.id)) return;
    cesta = nova;
    prekresli();
  });

  prekresli();
}

spust();

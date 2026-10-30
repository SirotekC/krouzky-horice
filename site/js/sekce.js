// Sekce webu: kroužky pro děti (index.html) a aktivity pro dospělé (dospeli.html).
// Stránka určuje sekci atributem `<body data-sekce="…">`.

import { KATEGORIE, KATEGORIE_DOSPELI, SKUPINY_KATEGORII, SKUPINY_KATEGORII_DOSPELI } from './data.js';

/**
 * @typedef {object} Sekce
 * @property {'deti' | 'dospeli'} klic
 * @property {string} soubor cesta k aktivitám sekce relativně k `data/`
 * @property {'deti' | 'dospeli'} druhaSekce
 * @property {'i_pro_deti' | 'i_pro_dospele'} priznakZDruhe příznak, kterým se aktivita druhé sekce zobrazí i v této
 * @property {Record<string, string>} kategorie
 * @property {Record<string, { popisek: string, kategorie: string[] }>} skupiny
 * @property {[string, string, string]} tvary tvary slova pro 1, 2–4 a 5+ aktivit
 * @property {string} odkazZpet
 * @property {string} stitekZDruhe štítek na kartě aktivity z druhé sekce
 * @property {string} akuzativ „Sdílet odkaz na …“
 * @property {string} nenalezeno text pro odkaz na neexistující aktivitu
 * @property {string} zadnaNeodpovida text prázdného výsledku
 */

/** @type {Readonly<Record<'deti' | 'dospeli', Sekce>>} */
export const SEKCE = Object.freeze({
  deti: Object.freeze({
    klic: 'deti',
    soubor: 'aktivity.json',
    druhaSekce: 'dospeli',
    priznakZDruhe: 'i_pro_deti',
    kategorie: KATEGORIE,
    skupiny: SKUPINY_KATEGORII,
    tvary: ['kroužek', 'kroužky', 'kroužků'],
    odkazZpet: '← Všechny kroužky',
    stitekZDruhe: 'Z nabídky pro dospělé',
    akuzativ: 'kroužek',
    nenalezeno: 'Tento kroužek jsme nenašli.',
    zadnaNeodpovida: 'Žádný kroužek neodpovídá filtrům.',
  }),
  dospeli: Object.freeze({
    klic: 'dospeli',
    soubor: 'dospeli/aktivity.json',
    druhaSekce: 'deti',
    priznakZDruhe: 'i_pro_dospele',
    kategorie: KATEGORIE_DOSPELI,
    skupiny: SKUPINY_KATEGORII_DOSPELI,
    tvary: ['aktivita', 'aktivity', 'aktivit'],
    odkazZpet: '← Všechny aktivity',
    stitekZDruhe: 'Z nabídky pro děti',
    akuzativ: 'aktivitu',
    nenalezeno: 'Tuto aktivitu jsme nenašli.',
    zadnaNeodpovida: 'Žádná aktivita neodpovídá filtrům.',
  }),
});

/**
 * Sekce podle `data-sekce` stránky (`document.body.dataset`). Neznámá nebo chybějící hodnota = děti.
 * @param {DOMStringMap | Record<string, string> | undefined} dataset
 * @returns {Sekce}
 */
export function aktualniSekce(dataset) {
  const klic = dataset?.sekce;
  return Object.hasOwn(SEKCE, klic ?? '') ? SEKCE[klic] : SEKCE.deti;
}

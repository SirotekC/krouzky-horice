// Stránka „O projektu“: seznam organizací (zdrojů dat) z organizace.json.
// Datum ověření organizace (overeno) zůstává jen v datech, na stránce se nezobrazuje.

import { nactiData } from './data.js';
import { el, externiOdkaz, nastavOdkazy } from './render.js';

async function spust() {
  nastavOdkazy();
  const kontejner = document.querySelector('#organizace');
  try {
    const { organizace } = await nactiData();
    const porovnej = new Intl.Collator('cs').compare;
    const seznam = el('ul');
    for (const o of [...organizace].sort((a, b) => porovnej(a.nazev, b.nazev))) {
      seznam.append(el('li', {}, externiOdkaz(o.web, o.nazev)));
    }
    kontejner.replaceChildren(organizace.length ? seznam : el('p', { text: 'Zatím zde nejsou žádné organizace.' }));
  } catch (chyba) {
    console.error(chyba);
    kontejner.replaceChildren(el('p', { text: 'Seznam organizací se nepodařilo načíst.' }));
  }
}

spust();

// Stránka „O projektu“: seznam organizací (zdrojů dat) z organizace.json.

import { TYPY_ORGANIZACI, nactiData } from './data.js';
import { formatDatum } from './registration.js';
import { el, externiOdkaz, nastavOdkazy } from './render.js';

async function spust() {
  nastavOdkazy();
  const kontejner = document.querySelector('#organizace');
  try {
    const { organizace } = await nactiData();
    const porovnej = new Intl.Collator('cs').compare;
    const seznam = el('ul');
    for (const o of [...organizace].sort((a, b) => porovnej(a.nazev, b.nazev))) {
      seznam.append(
        el(
          'li',
          {},
          externiOdkaz(o.web, o.nazev),
          ` (${TYPY_ORGANIZACI[o.typ] ?? o.typ}), ověřeno ${formatDatum(o.overeno)}`,
        ),
      );
    }
    kontejner.replaceChildren(organizace.length ? seznam : el('p', { text: 'Zatím zde nejsou žádné organizace.' }));
  } catch (chyba) {
    console.error(chyba);
    kontejner.replaceChildren(el('p', { text: 'Seznam organizací se nepodařilo načíst.' }));
  }
}

spust();

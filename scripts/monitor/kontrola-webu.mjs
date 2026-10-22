// Data pro web: site/data/kontrola.json (datum poslední úspěšné kontroly zdroj_url a datum pro zápatí).

/**
 * Sestaví obsah `site/data/kontrola.json` ze stavu monitoringu.
 * Obsahuje jen URL ze seznamu, které se používají jako `zdroj_url` a mají `posledniOk`.
 * @param {{ zapatiDatum: string|null, url: Record<string, { posledniOk: string|null }> }} stav
 * @param {Map<string, { pouziti: { id: string, pole: string }[] }>} seznam výstup `sestavSeznamUrl`
 * @returns {{ zdrojeZkontrolovany: string|null, url: Record<string, string> }}
 */
export function sestavKontrolu(stav, seznam) {
  const url = {};
  for (const adresa of [...seznam.keys()].sort()) {
    if (!seznam.get(adresa).pouziti.some((p) => p.pole === 'zdroj_url')) continue;
    const posledniOk = stav.url[adresa]?.posledniOk;
    if (posledniOk != null) url[adresa] = posledniOk;
  }
  return { zdrojeZkontrolovany: stav.zapatiDatum ?? null, url };
}

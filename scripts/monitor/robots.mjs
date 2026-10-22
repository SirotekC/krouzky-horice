// Pravidla robots.txt: výběr skupiny pro náš User-Agent, Allow/Disallow, Crawl-delay.

const TOKEN = 'krouzkyhorice-monitor';

/**
 * Převede vzor z robots.txt (s `*` a `$`) na regulární výraz zakotvený na začátku cesty.
 * @param {string} vzor
 * @returns {RegExp}
 */
function vzorNaRegex(vzor) {
  const konci = vzor.endsWith('$');
  const telo = (konci ? vzor.slice(0, -1) : vzor)
    .split('*')
    .map((cast) => cast.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${telo}${konci ? '$' : ''}`);
}

/**
 * Zpracuje text robots.txt pro daný User-Agent.
 * Skupina se vybere, když je její `User-agent` podřetězcem našeho tokenu (bez ohledu na velikost
 * písmen), jinak se použije `*`. Crawl-delay je z vybrané skupiny, jinak globální (mimo skupiny).
 * @param {string} text
 * @param {string} userAgent
 * @returns {{ povoleno(cesta: string): boolean, crawlDelay: number|null }}
 */
export function parsujRobots(text, userAgent) {
  const token = (userAgent.split('/')[0] || TOKEN).toLowerCase();
  const skupiny = [];
  let globalniDelay = null;
  let aktualni = null;
  let predchoziByloAgent = false;

  for (const surovy of String(text ?? '').split(/\r?\n/)) {
    const radek = surovy.replace(/#.*/, '').trim();
    const dvojtecka = radek.indexOf(':');
    if (dvojtecka < 0) continue;
    const klic = radek.slice(0, dvojtecka).trim().toLowerCase();
    const hodnota = radek.slice(dvojtecka + 1).trim();

    if (klic === 'user-agent') {
      if (!predchoziByloAgent || !aktualni) {
        aktualni = { agenti: [], pravidla: [], delay: null };
        skupiny.push(aktualni);
      }
      aktualni.agenti.push(hodnota.toLowerCase());
      predchoziByloAgent = true;
      continue;
    }
    predchoziByloAgent = false;
    if (klic === 'crawl-delay') {
      const n = Number(hodnota);
      if (!Number.isFinite(n) || n < 0) continue;
      if (aktualni) aktualni.delay = n;
      else globalniDelay = n;
    } else if ((klic === 'allow' || klic === 'disallow') && aktualni) {
      // Prázdný Disallow nic nezakazuje, prázdný Allow nic neřeší.
      if (hodnota) aktualni.pravidla.push({ povol: klic === 'allow', vzor: hodnota, regex: vzorNaRegex(hodnota) });
    }
  }

  const nase = skupiny.filter((s) => s.agenti.some((a) => a && a !== '*' && token.includes(a)));
  const vybrane = nase.length ? nase : skupiny.filter((s) => s.agenti.includes('*'));
  const pravidla = vybrane.flatMap((s) => s.pravidla);
  const zeSkupiny = vybrane.find((s) => s.delay !== null)?.delay ?? null;

  return {
    povoleno(cesta) {
      let nejlepsi = null;
      for (const p of pravidla) {
        if (!p.regex.test(cesta)) continue;
        if (!nejlepsi || p.vzor.length > nejlepsi.vzor.length
          || (p.vzor.length === nejlepsi.vzor.length && p.povol)) nejlepsi = p;
      }
      return nejlepsi ? nejlepsi.povol : true;
    },
    crawlDelay: zeSkupiny ?? globalniDelay,
  };
}

/**
 * Vyhodnotí odpověď na požadavek `/robots.txt`.
 * 2xx = parsovat, 4xx (i 404) = vše povoleno, 5xx nebo síťová chyba (`null`) = `nedostupny`.
 * @param {number|null} status
 * @param {string|null} text
 * @param {string} userAgent
 * @returns {{ stav: 'ok'|'nedostupny', pravidla: ReturnType<typeof parsujRobots>|null }}
 */
export function robotsZOdpovedi(status, text, userAgent) {
  if (status === null || status === undefined || status >= 500) return { stav: 'nedostupny', pravidla: null };
  if (status >= 200 && status < 300) return { stav: 'ok', pravidla: parsujRobots(text ?? '', userAgent) };
  if (status >= 400) return { stav: 'ok', pravidla: parsujRobots('', userAgent) };
  return { stav: 'nedostupny', pravidla: null };
}

// Nastavení webu. Adresa repozitáře na GitHubu (nebo `null`). Na webu se
// nezobrazuje, slouží jen jako záloha pro odkaz „Nahlásit chybu“, když chybí e-mail.
export const REPO_URL = 'https://github.com/SirotekC/krouzky-horice';

/** Veřejný e-mail pro opravy a dotazy, nebo `null`. */
export const KONTAKT_EMAIL = 'cenek.sirotek@gmail.com';

/** Odkaz pro nahlášení chyby: e-mail, jinak GitHub Issues, jinak `null` (odkaz se skryje). */
export const CHYBA_URL = KONTAKT_EMAIL
  ? `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Kroužky Hořice – oprava')}`
  : REPO_URL ? `${REPO_URL}/issues/new` : null;

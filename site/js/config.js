// Nastavení webu. Po založení repozitáře na GitHubu doplňte adresu,
// např. 'https://github.com/uzivatel/clubs-horice'. Dokud je `null`,
// odkazy na repozitář a nahlášení chyby se nezobrazují.
export const REPO_URL = null;

/** Odkaz pro nahlášení chyby (GitHub Issues), nebo `null`. */
export const CHYBA_URL = REPO_URL ? `${REPO_URL}/issues/new` : null;

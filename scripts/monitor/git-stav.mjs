// Práce s větví monitor-stav: dočasný worktree, commit a push s opakováním při souběhu.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const VYCHOZI_SPUST = promisify(execFile);

/**
 * Vytvoří worktree větve `monitor-stav` (podle `origin`) v dočasném adresáři, zavolá `fn(adresar)`,
 * změny commitne se zprávou, kterou `fn` vrátí, a pushne.
 * Odmítnutý push (souběžný zápis workflow) = `fetch` čerstvé větve, `reset --hard` na ni a `fn` znovu
 * nad novým stavem (žádný rebase, ten by u sousedních řádků stav.json skončil konfliktem).
 * Celkem nejvýš `pokusy` pushů, pak výjimka. Worktree se vždy odstraní.
 * @param {(adresar: string) => Promise<string>} fn vrací zprávu commitu; musí jít spustit opakovaně
 * @param {{ spust?: (prikaz: string, args: string[], moznosti?: { cwd?: string }) => Promise<{ stdout: string }>,
 *   koren?: string, vetev?: string, vzdalene?: string, pokusy?: number }} [moznosti]
 * @returns {Promise<boolean>} `true` = commitnuto a pushnuto, `false` = beze změny (nic se nepushuje)
 */
export async function sGitStavem(fn, { spust = VYCHOZI_SPUST, koren = process.cwd(), vetev = 'monitor-stav', vzdalene = 'origin', pokusy = 3 } = {}) {
  const git = (args, cwd) => spust('git', args, { cwd });
  const ref = `refs/remotes/${vzdalene}/${vetev}`;
  // Refspec explicitně aktualizuje vzdálenou větev (samotné `fetch origin vetev` ji nemusí posunout).
  const stahni = (cwd) => git(['fetch', vzdalene, `+${vetev}:${ref}`], cwd);

  await stahni(koren);
  const adresar = await mkdtemp(path.join(tmpdir(), 'monitor-stav-'));
  try {
    await git(['worktree', 'add', '--detach', adresar, ref], koren);
    for (let pokus = 1; ; pokus++) {
      const zprava = await fn(adresar);
      await git(['add', '-A'], adresar);
      const { stdout } = await git(['status', '--porcelain'], adresar);
      if (!String(stdout ?? '').trim()) return false;
      await git(['commit', '-m', zprava], adresar);
      try {
        await git(['push', vzdalene, `HEAD:${vetev}`], adresar);
        return true;
      } catch (e) {
        if (pokus >= pokusy) {
          throw new Error(`Větev ${vetev} se nepodařilo pushnout ani na ${pokusy}. pokus (souběžné změny?): ${String(e.stderr || e.message).trim()}`);
        }
        await stahni(adresar);
        await git(['reset', '--hard', ref], adresar);
      }
    }
  } finally {
    await git(['worktree', 'remove', '--force', adresar], koren).catch(() => {});
    await rm(adresar, { recursive: true, force: true });
  }
}

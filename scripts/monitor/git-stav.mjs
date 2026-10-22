// Práce s větví monitor-stav: dočasný worktree, commit a push s opakováním při souběhu.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const VYCHOZI_SPUST = promisify(execFile);

/**
 * Vytvoří worktree větve `monitor-stav` (podle `origin`) v dočasném adresáři, zavolá `fn(adresar)`,
 * změny commitne se zprávou, kterou `fn` vrátí, a pushne. Odmítnutý push = `pull --rebase` a nový
 * pokus, celkem nejvýš `pokusy` pushů, pak výjimka. Worktree se vždy odstraní.
 * @param {(adresar: string) => Promise<string>} fn vrací zprávu commitu
 * @param {{ spust?: (prikaz: string, args: string[], moznosti?: { cwd?: string }) => Promise<{ stdout: string }>,
 *   koren?: string, vetev?: string, vzdalene?: string, pokusy?: number }} [moznosti]
 * @returns {Promise<boolean>} `true`, když se commitovalo (`false` = beze změny)
 */
export async function sGitStavem(fn, { spust = VYCHOZI_SPUST, koren = process.cwd(), vetev = 'monitor-stav', vzdalene = 'origin', pokusy = 3 } = {}) {
  const git = (args, cwd) => spust('git', args, { cwd });

  await git(['fetch', vzdalene, vetev], koren);
  const adresar = await mkdtemp(path.join(tmpdir(), 'monitor-stav-'));
  try {
    await git(['worktree', 'add', '--detach', adresar, `${vzdalene}/${vetev}`], koren);
    const zprava = await fn(adresar);
    await git(['add', '-A'], adresar);
    const { stdout } = await git(['status', '--porcelain'], adresar);
    if (!String(stdout ?? '').trim()) return false;
    await git(['commit', '-m', zprava], adresar);

    for (let pokus = 1; ; pokus++) {
      try {
        await git(['push', vzdalene, `HEAD:${vetev}`], adresar);
        return true;
      } catch (e) {
        if (pokus >= pokusy) {
          throw new Error(`push do ${vzdalene}/${vetev} selhal ${pokusy}× po sobě: ${String(e.stderr || e.message).trim()}`);
        }
        await git(['pull', '--rebase', vzdalene, vetev], adresar);
      }
    }
  } finally {
    await git(['worktree', 'remove', '--force', adresar], koren).catch(() => {});
    await rm(adresar, { recursive: true, force: true });
  }
}

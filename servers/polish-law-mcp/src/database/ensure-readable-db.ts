import { copyFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Workaround for the node-sqlite3-wasm + Docker overlay2 incompatibility:
 * the WASM SQLite driver opens overlay-stored DBs successfully but every
 * page-level read fails with "disk I/O error" or "database is locked".
 *
 * Copy the DB to tmpdir once at startup; subsequent calls reuse it.
 */
export function ensureReadableDb(srcPath: string): string {
  if (!existsSync(srcPath)) {
    const candidates = [
      join(process.cwd(), 'data', basename(srcPath)),
      join(process.cwd(), 'servers', 'polish-law-mcp', 'data', basename(srcPath)),
      join(__dirname, '..', '..', 'data', basename(srcPath)),
      join(__dirname, '..', 'data', basename(srcPath)),
      join(tmpdir(), basename(srcPath))
    ];
    for (const c of candidates) {
      if (existsSync(c)) {
        srcPath = c;
        break;
      }
    }
  }

  const tmpPath = join(tmpdir(), basename(srcPath));
  if (srcPath === tmpPath) return srcPath;

  if (!existsSync(srcPath)) {
    if (existsSync(tmpPath)) return tmpPath;
    return srcPath;
  }

  try {
    const destDir = dirname(tmpPath);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    if (!existsSync(tmpPath)) {
      copyFileSync(srcPath, tmpPath);
      return tmpPath;
    }

    const srcMtime = statSync(srcPath).mtimeMs;
    const tmpMtime = statSync(tmpPath).mtimeMs;
    if (srcMtime > tmpMtime) {
      copyFileSync(srcPath, tmpPath);
    }
  } catch (err) {
    console.warn(`[ensureReadableDb] Falling back to original path ${srcPath}: ${String(err)}`);
    return srcPath;
  }

  return tmpPath;
}

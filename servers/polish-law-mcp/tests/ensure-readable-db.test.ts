import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  statSync,
  utimesSync,
  unlinkSync,
} from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureReadableDb } from '../src/database/ensure-readable-db.js';

// Source scratch dir MUST live outside /tmp — the helper short-circuits when
// the source path already begins with /tmp/, which is the prod path we must
// never disturb. Anchor to repo root.
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRATCH_ROOT = join(__dirname, '..', '.tmp-test-scratch');

describe('ensureReadableDb', () => {
  let workDir: string;
  let srcPath: string;
  let tmpPath: string;

  beforeEach(() => {
    rmSync(SCRATCH_ROOT, { recursive: true, force: true });
    workDir = mkdtempSync(SCRATCH_ROOT + '-');
    const dbName = `test-${process.pid}-${Date.now()}.db`;
    srcPath = join(workDir, dbName);
    tmpPath = join('/tmp', basename(srcPath));
    writeFileSync(srcPath, 'ORIGINAL_CONTENT');
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  });

  it('returns the original path unchanged when already under /tmp/', () => {
    expect(ensureReadableDb('/tmp/already-here.db')).toBe('/tmp/already-here.db');
  });

  it('copies the DB to /tmp on first call and returns the /tmp path', () => {
    expect(existsSync(tmpPath)).toBe(false);
    const result = ensureReadableDb(srcPath);
    expect(result).toBe(tmpPath);
    expect(existsSync(tmpPath)).toBe(true);
    expect(readFileSync(tmpPath, 'utf-8')).toBe('ORIGINAL_CONTENT');
  });

  it('refreshes the /tmp copy when the source mtime is newer than the cached copy', () => {
    ensureReadableDb(srcPath);
    expect(readFileSync(tmpPath, 'utf-8')).toBe('ORIGINAL_CONTENT');

    const past = new Date(Date.now() - 60_000);
    utimesSync(tmpPath, past, past);
    const tmpMtimeBefore = statSync(tmpPath).mtimeMs;

    writeFileSync(srcPath, 'UPDATED_CONTENT');
    const future = new Date(Date.now() + 60_000);
    utimesSync(srcPath, future, future);

    const result = ensureReadableDb(srcPath);
    expect(result).toBe(tmpPath);
    expect(readFileSync(tmpPath, 'utf-8')).toBe('UPDATED_CONTENT');
    expect(statSync(tmpPath).mtimeMs).toBeGreaterThan(tmpMtimeBefore);
  });
});

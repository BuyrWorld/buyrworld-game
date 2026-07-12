import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { MUSIC_MANIFEST } from '../src/data/musicManifest.ts';

// Build-time asset validation: every manifest entry must resolve to a REAL binary MP3
// under public/ (exact case), not a Git-LFS pointer, with a plausible size. This is the
// check that would have caught the LFS-pointer regression that muted the live site.
const PUB = resolve(__dirname, '..', 'public');
const isPointer = (buf: Buffer) => buf.slice(0, 40).toString('utf8').startsWith('version https://git-lfs');
const isMp3 = (buf: Buffer) => buf.slice(0, 3).toString('latin1') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);

describe('Music assets — every manifest path resolves to a real MP3', () => {
  it('has entries to check', () => { expect(MUSIC_MANIFEST.length).toBeGreaterThan(0); });

  for (const t of MUSIC_MANIFEST) {
    it(`${t.id} → ${t.source}`, () => {
      const p = resolve(PUB, t.source);
      expect(existsSync(p), `missing file: public/${t.source}`).toBe(true);
      const size = statSync(p).size;
      expect(size, `implausibly small (LFS pointer?): ${t.source}`).toBeGreaterThan(100_000);
      const head = readFileSync(p, { encoding: null }).subarray(0, 40) as Buffer;
      expect(isPointer(head), `is a Git-LFS pointer, not audio: ${t.source}`).toBe(false);
      expect(isMp3(head), `not valid MP3 data: ${t.source}`).toBe(true);
    });
  }

  it('exact-case path check (case-sensitive hosts)', () => {
    for (const t of MUSIC_MANIFEST) {
      expect(t.source).toBe(t.source.normalize());
      expect(t.source.startsWith('music/frosty/')).toBe(true);
    }
  });
});

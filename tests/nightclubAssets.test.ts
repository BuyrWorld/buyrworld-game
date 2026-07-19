import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

const root = fileURLToPath(new URL('..', import.meta.url));

// Recursively collect every source file under src/ (production code).
function srcFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) srcFiles(p, acc);
    else if (/\.(ts|tsx|js|css|html)$/.test(name)) acc.push(p);
  }
  return acc;
}

describe('Nightclub — reference render is dev-only, never shipped', () => {
  const files = srcFiles(join(root, 'src'));

  it('no production source imports/loads the reference render or a runtime derivative', () => {
    const forbidden = ['nightclub-final-reference', 'nightclub-base', 'club-plate'];
    const hits: string[] = [];
    for (const f of files) {
      const txt = readFileSync(f, 'utf8');
      for (const term of forbidden) if (txt.includes(term)) hits.push(`${f.replace(root, '')} → "${term}"`);
    }
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('the runtime derivative asset does not exist (removed from the build)', () => {
    expect(existsSync(join(root, 'public/assets/interior/nightclub-base.png'))).toBe(false);
  });

  it('the source reference is preserved under references/ for development only', () => {
    expect(existsSync(join(root, 'references/nightclub/nightclub-final-reference.png'))).toBe(true);
  });

  it('no snowman/mascot Frosty in the nightclub renderer (Frosty is a human)', () => {
    const main = readFileSync(join(root, 'src/main.ts'), 'utf8');
    // the old snowman DJ had a "carrot nose"; ensure that representation is gone
    expect(main.includes('carrot nose')).toBe(false);
    // and the DJ is explicitly the canonical human
    expect(main.includes('CANONICAL HUMAN')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const DIRS = ['api', 'lib', 'hooks', 'contexts', 'components', 'app'];

/** Files allowed to call the platform fetch directly, with the reason. */
const ALLOWED: Record<string, string> = {
  'lib/http/apiFetch.ts': 'the helper itself',
  'lib/excel/cache.ts': 'reads an object URL that was already made in the browser, not a backend URL',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('backend requests go through apiFetch', () => {
  it('no source file calls fetch() directly', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, file).split('\\').join('/');
        if (ALLOWED[rel]) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (/(?<![\w.$])fetch\s*\(/.test(line) && !/^\s*(\/\/|\*)/.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the browser never loads a backend URL itself (no src/href/EventSource/window.open on the API base)', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, file).split('\\').join('/');
        const text = readFileSync(file, 'utf8');
        if (/new\s+EventSource\s*\(/.test(text)) offenders.push(`${rel}: EventSource`);
        if (/window\.open\s*\(/.test(text)) offenders.push(`${rel}: window.open`);
        if (/\b(src|href|data)=\{[^}]*(config\.api|API_URL|API_BASE_URL)/.test(text)) offenders.push(`${rel}: element URL on the API base`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

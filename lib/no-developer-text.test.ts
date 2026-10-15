import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard: text a battery engineer reads must not contain developer wording
 * (backend item codes, step/decision codes, route names, file names of our own
 * notes). It scans the text of string literals and plain JSX text; code,
 * comments, imports, test files, the dev gallery and console calls are not
 * scanned.
 */
const ROOT = process.cwd();
const DIRS = ['app', 'components', 'lib', 'hooks', 'contexts', 'static', 'api'];

const FORBIDDEN: [string, RegExp][] = [
  ['backend', /\bbackend\b/i],
  ['backend item code', /\(B\d{1,2}\)|\bB\d{1,2}\)|\bitem B\d/],
  ['decision code', /\bAM\d{1,2}\b/],
  ['CLAUDE.md', /CLAUDE\.md/],
  ['task code', /\bTask [AB]\b/],
  ['API', /\bAPI\b/],
  ['Web Locks', /Web Locks/],
  ['SSE', /\bSSE\b/],
  ['TODO', /\bTODO\b|\bFIXME\b/],
  ['stub/mock', /\bstub\b|\bmock\b/i],
  ['UUID', /\bUUID\b/i],
  ['endpoint/route', /\bendpoint\b|\bno route\b/i],
  ['slot', /\ba slot\b|\bevery slot\b|\bThis slot\b/],
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === 'node_modules' || n === '.next') return [];
    if (statSync(p).isDirectory()) return n === 'dev' ? [] : files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

/** Removes block comments and `//` comments (a `//` inside a string is kept). */
function stripComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  // console calls are not user text, even when they span several lines
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/console\.\w+\([\s\S]*?\);/g, blank);
  return noBlock
    .split('\n')
    .map((line) => {
      let quote = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
          if (c === '\\') i++;
          else if (c === quote) quote = '';
        } else if (c === "'" || c === '"' || c === '`') quote = c;
        else if (c === '/' && line[i + 1] === '/' && (i === 0 || /[\s;,)}]/.test(line[i - 1]))) return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

/** The user-visible text of one source line, or ''. */
function textOf(line: string): string {
  if (/console\.(log|error|warn|info)/.test(line) || /^\s*(import|export \* from)\b|^\s*\} from /.test(line)) return '';
  const literals = [...line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]).join(' ');
  const noEntities = line.replace(/&[a-z]+;/g, ' ');
  const jsx = [...noEntities.matchAll(/>([^<>]*[A-Za-z]{3,}[^<>]*)(?=<|$)/g)].map((m) => m[1]).join(' ');
  const plain = /^\s*[A-Z][a-z]+ [a-z][^=;<>]*$/.test(noEntities) ? noEntities : '';
  return `${literals} ${jsx} ${plain}`.replace(/\$\{API\}/g, '');
}

describe('no developer-facing wording in user text', () => {
  const hits: string[] = [];
  for (const dir of DIRS) {
    for (const f of files(join(ROOT, dir))) {
      stripComments(readFileSync(f, 'utf8')).split('\n').forEach((line, i) => {
        const text = textOf(line);
        for (const [name, re] of FORBIDDEN) {
          if (re.test(text)) hits.push(`${relative(ROOT, f)}:${i + 1} [${name}] ${line.trim().slice(0, 140)}`);
        }
      });
    }
  }
  it('finds none', () => {
    expect(hits).toEqual([]);
  });
});

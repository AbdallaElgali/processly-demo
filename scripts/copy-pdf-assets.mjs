// Copies the pdf.js worker, CMaps and standard fonts into public/pdfjs/ so the
// viewer never loads them from a CDN (plan-A §8, explore-A R11). Run by
// `predev` and `prebuild`, not `prepare`: the Dockerfile's deps stage runs
// `npm ci` before the scripts/ directory is copied in.
//
// The files are taken from the pdfjs-dist that react-pdf itself resolves, so
// the worker always matches the API version (pdf.js refuses a mismatch).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'node_modules/react-pdf/package.json'));
const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
const out = join(root, 'public/pdfjs');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(pdfjsDir, 'build/pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'));
for (const dir of ['cmaps', 'standard_fonts']) {
  const src = join(pdfjsDir, dir);
  if (existsSync(src)) cpSync(src, join(out, dir), { recursive: true });
}
const { version } = require('pdfjs-dist/package.json');
process.stdout.write(`pdf.js ${version} assets copied to public/pdfjs/\n`);

import { PARSE_CACHE_SIZE } from './config';
import { parseWorkbook, type WorkbookModel } from './workbook';

/**
 * Parsed workbooks by file URL. A viewer that drops out of the mounted set
 * (KEEP_MOUNTED) and comes back reuses the parse instead of repeating it.
 * The URL is an object URL from the document file store, so a re-fetched file
 * gets a new URL and a fresh parse.
 */
const cache = new Map<string, Promise<WorkbookModel>>();

export function loadWorkbook(url: string, load: (url: string) => Promise<ArrayBuffer> = fetchBuffer): Promise<WorkbookModel> {
  const hit = cache.get(url);
  if (hit) {
    cache.delete(url);
    cache.set(url, hit);
    return hit;
  }
  const p = load(url).then((buf) => parseWorkbook(buf));
  p.catch(() => cache.delete(url));
  cache.set(url, p);
  while (cache.size > PARSE_CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return p;
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not read the file (${res.status}).`);
  return res.arrayBuffer();
}

/** For tests and sign-out. */
export function clearWorkbookCache() {
  cache.clear();
}

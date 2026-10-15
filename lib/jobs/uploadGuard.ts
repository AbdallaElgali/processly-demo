import type { Job, PendingFileRef } from './types';

/**
 * Guards against uploading the same file twice by accident.
 *
 * A file counts as already there when the project holds a document with the
 * same name (and the same size, when the document's size is known: the
 * project payload carries none, so it is known only after the file has been
 * opened), or when an upload queued or running for this project holds a file
 * with the same name and size.
 */

export interface UploadCandidate {
  name: string;
  size: number;
}

export interface KnownDocument {
  id: string;
  name: string;
  /** Size in bytes when the file has been loaded, 0 when not known. */
  bytes: number;
}

const norm = (name: string) => name.trim().toLowerCase();

/** The file descriptions stored on an upload job, so the tabs and the guard can see them. */
export function fileRefsOf(jobId: string, files: { name: string; size: number; type: string }[]): PendingFileRef[] {
  return files.map((f, index) => ({ idbId: `${jobId}:${index}`, name: f.name, type: f.type, size: f.size }));
}

export function findDuplicateUploads<T extends UploadCandidate>(
  files: T[],
  ctx: { projectId: string; documents: KnownDocument[]; jobs: Job[] },
): { fresh: T[]; duplicates: T[] } {
  const waiting = new Set<string>();
  for (const job of ctx.jobs) {
    if (job.projectId !== ctx.projectId || job.payload.kind !== 'upload') continue;
    if (job.status !== 'queued' && job.status !== 'running') continue;
    for (const ref of job.payload.fileRefs) waiting.add(`${norm(ref.name)}|${ref.size}`);
  }
  const held = ctx.documents.map((d) => ({ name: norm(d.name), bytes: d.bytes }));

  const fresh: T[] = [];
  const duplicates: T[] = [];
  const seenNow = new Set<string>();
  for (const file of files) {
    const key = `${norm(file.name)}|${file.size}`;
    const inProject = held.some((d) => d.name === norm(file.name) && (d.bytes <= 0 || d.bytes === file.size));
    if (inProject || waiting.has(key) || seenNow.has(key)) duplicates.push(file);
    else fresh.push(file);
    seenNow.add(key);
  }
  return { fresh, duplicates };
}

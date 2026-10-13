import Dexie, { Table } from 'dexie';

/**
 * A file belonging to a queued upload.
 *
 * CLAUDE.md 8.1 requires the queue to survive a refresh, and a queued upload
 * is only meaningful if its files survive too. Blobs cannot go in
 * localStorage, so they live here and are deleted as soon as the upload
 * succeeds, is cancelled, or its job is dismissed.
 */
export interface PendingUpload {
  /** `${jobId}:${index}`, so one job's files are easy to find and delete. */
  id: string;
  jobId: string;
  projectId: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  createdAt: number;
}

export class BdaDatabase extends Dexie {
  pendingUploads!: Table<PendingUpload>;

  constructor() {
    super('BatterySpecDB');

    // v1 declared a `files` table that nothing ever read or wrote (confirmed by
    // grep in explore-A). It is dropped rather than migrated: there is no data
    // worth keeping, and leaving it would imply it meant something.
    this.version(1).stores({ files: 'id, name' });
    this.version(2)
      .stores({
        files: null,
        pendingUploads: 'id, jobId, projectId',
      });
  }
}

export const db = new BdaDatabase();

export async function savePendingFiles(
  jobId: string,
  projectId: string,
  files: File[],
): Promise<void> {
  await db.pendingUploads.bulkPut(
    files.map((file, index) => ({
      id: `${jobId}:${index}`,
      jobId,
      projectId,
      name: file.name,
      type: file.type,
      size: file.size,
      blob: file,
      createdAt: Date.now(),
    })),
  );
}

export async function loadPendingFiles(jobId: string): Promise<File[]> {
  const rows = await db.pendingUploads.where('jobId').equals(jobId).sortBy('id');
  return rows.map((row) => new File([row.blob], row.name, { type: row.type }));
}

export async function deletePendingFiles(jobId: string): Promise<void> {
  await db.pendingUploads.where('jobId').equals(jobId).delete();
}

/** Drops blobs whose job no longer exists, so storage cannot grow unbounded. */
export async function sweepPendingFiles(liveJobIds: Set<string>): Promise<number> {
  const all = await db.pendingUploads.toArray();
  const orphans = all.filter((row) => !liveJobIds.has(row.jobId)).map((row) => row.id);
  if (orphans.length > 0) await db.pendingUploads.bulkDelete(orphans);
  return orphans.length;
}

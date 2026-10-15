import { describe, expect, it } from 'vitest';
import { fileRefsOf, findDuplicateUploads } from './uploadGuard';
import type { Job, JobStatus } from './types';

const uploadJob = (id: string, status: JobStatus, files: { name: string; size: number }[], projectId = 'p1'): Job => ({
  id, projectId, kind: 'upload', status, createdAt: 1, phase: 'queued', events: [], warnings: [],
  progress: { categoriesDone: [], categoriesFailed: [] }, seen: false,
  payload: { kind: 'upload', fileRefs: files.map((f, i) => ({ idbId: `${id}:${i}`, name: f.name, type: 'application/pdf', size: f.size })) },
});
const file = (name: string, size: number) => ({ name, size });

describe('duplicate upload guard', () => {
  it('flags a file whose name and size match an upload already queued', () => {
    const out = findDuplicateUploads([file('a.pdf', 10)], { projectId: 'p1', documents: [], jobs: [uploadJob('u', 'queued', [file('a.pdf', 10)])] });
    expect(out.duplicates.map((f) => f.name)).toEqual(['a.pdf']);
    expect(out.fresh).toEqual([]);
  });

  it('flags one that matches an upload running right now', () => {
    const out = findDuplicateUploads([file('a.pdf', 10)], { projectId: 'p1', documents: [], jobs: [uploadJob('u', 'running', [file('a.pdf', 10)])] });
    expect(out.duplicates).toHaveLength(1);
  });

  it('does not flag the same name with a different size among uploads', () => {
    const out = findDuplicateUploads([file('a.pdf', 11)], { projectId: 'p1', documents: [], jobs: [uploadJob('u', 'queued', [file('a.pdf', 10)])] });
    expect(out.duplicates).toEqual([]);
  });

  it('ignores finished, failed and cancelled uploads and other projects', () => {
    const jobs = [
      uploadJob('a', 'failed', [file('a.pdf', 10)]),
      uploadJob('b', 'completed', [file('a.pdf', 10)]),
      uploadJob('c', 'cancelled', [file('a.pdf', 10)]),
      uploadJob('d', 'running', [file('a.pdf', 10)], 'other'),
    ];
    expect(findDuplicateUploads([file('a.pdf', 10)], { projectId: 'p1', documents: [], jobs }).duplicates).toEqual([]);
  });

  it('flags a file with the same name and size as a document in the project', () => {
    const documents = [{ id: 'd1', name: 'a.pdf', bytes: 10 }];
    expect(findDuplicateUploads([file('a.pdf', 10)], { projectId: 'p1', documents, jobs: [] }).duplicates).toHaveLength(1);
  });

  it('does not flag a project document of the same name but a different known size', () => {
    const documents = [{ id: 'd1', name: 'a.pdf', bytes: 99 }];
    expect(findDuplicateUploads([file('a.pdf', 10)], { projectId: 'p1', documents, jobs: [] }).duplicates).toEqual([]);
  });

  it('matches by name alone when the size of the project document is not known yet', () => {
    const documents = [{ id: 'd1', name: 'a.pdf', bytes: 0 }];
    expect(findDuplicateUploads([file('a.pdf', 10)], { projectId: 'p1', documents, jobs: [] }).duplicates).toHaveLength(1);
  });

  it('flags the same file twice in one drop, keeping the first', () => {
    const out = findDuplicateUploads([file('a.pdf', 10), file('a.pdf', 10)], { projectId: 'p1', documents: [], jobs: [] });
    expect(out.fresh).toHaveLength(1);
    expect(out.duplicates).toHaveLength(1);
  });

  it('passes new files through', () => {
    const out = findDuplicateUploads([file('new.pdf', 1), file('b.pdf', 2)], { projectId: 'p1', documents: [{ id: 'd', name: 'a.pdf', bytes: 1 }], jobs: [] });
    expect(out.fresh.map((f) => f.name)).toEqual(['new.pdf', 'b.pdf']);
    expect(out.duplicates).toEqual([]);
  });
});

describe('fileRefsOf', () => {
  it('describes the files of an upload job, so the tabs and the guard can see them', () => {
    expect(fileRefsOf('j1', [{ name: 'a.pdf', size: 3, type: 'application/pdf' }, { name: 'b.xlsx', size: 4, type: '' }])).toEqual([
      { idbId: 'j1:0', name: 'a.pdf', type: 'application/pdf', size: 3 },
      { idbId: 'j1:1', name: 'b.xlsx', type: '', size: 4 },
    ]);
  });
});

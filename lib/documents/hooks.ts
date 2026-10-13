'use client';

import { useSyncExternalStore } from 'react';
import { documentFiles, type DocFileState } from './fileStore';

const EMPTY: ReadonlyMap<string, DocFileState> = new Map();

/** Every document file's state; one stable map per change. */
export function useDocumentFiles(): ReadonlyMap<string, DocFileState> {
  return useSyncExternalStore(documentFiles.subscribe, documentFiles.getSnapshot, () => EMPTY);
}

import Dexie, { Table } from 'dexie';

export interface CachedFile {
  id: string; // activeFileId from your app
  name: string;
  fileBlob: Blob;
  lastModified: number;
}

export class MyDatabase extends Dexie {
  files!: Table<CachedFile>;

  constructor() {
    super('BatterySpecDB');
    this.version(1).stores({
      files: 'id, name' // Primary key is id, index name
    });
  }
}

export const db = new MyDatabase();
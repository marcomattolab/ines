import { Injectable } from '@angular/core';
import { BaseIndexedDbService, BaseDocument, BaseChunk } from './base-indexed-db.service';

export interface ProjectDocument extends BaseDocument {}

export interface ProjectChunk extends BaseChunk {}

const DB_NAME = 'InesProjectDB';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class ProjectService extends BaseIndexedDbService<ProjectDocument, ProjectChunk> {
  protected override readonly dbName = DB_NAME;
  protected override readonly dbVersion = DB_VERSION;

  protected override onUpgrade(): void {
    /* no additional stores */
  }

  async getChunksForDocument(docId: string): Promise<ProjectChunk[]> {
    const all = await this.getAllFromStore<ProjectChunk>('chunks');
    return all.filter((c) => c.docId === docId).sort((a, b) => a.position - b.position);
  }

  async exportProject(): Promise<Blob> {
    const docs = await this.getAllFromStore<ProjectDocument>('documents');
    const chunks = await this.getAllFromStore<ProjectChunk>('chunks');
    const data = JSON.stringify(
      { version: 1, exported: Date.now(), documents: docs, chunks },
      null,
      2,
    );
    return new Blob([data], { type: 'application/json' });
  }

  async importProject(file: File): Promise<void> {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.documents?.length) throw new Error('Invalid project file');

    const db = await this.ensureDB();
    const tx = db.transaction(['documents', 'chunks'], 'readwrite');
    const docStore = tx.objectStore('documents');
    const chunkStore = tx.objectStore('chunks');

    for (const doc of data.documents) {
      await new Promise<void>((resolve, reject) => {
        const req = docStore.put(doc);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    if (data.chunks) {
      for (const chunk of data.chunks) {
        await new Promise<void>((resolve, reject) => {
          const req = chunkStore.put(chunk);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

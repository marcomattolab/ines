import { Injectable } from '@angular/core';

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision';

/** Same DB/store used by VisionService so vision models are downloaded once. */
const VISION_DB_NAME = 'InesVisionCacheDB';
const VISION_DB_VERSION = 1;
const VISION_STORE = 'models';

export const HAND_LANDMARKER_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
export const FACE_LANDMARKER_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
export const SELFIE_SEGMENTER_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

/**
 * Lightweight MediaPipe task loaders (hand, face, selfie segmenter) shared by
 * the Pinch & Scroll, Cursore con la testa and Sfondo intelligente tabs.
 * Models are fetched once and cached in IndexedDB (same store as VisionService).
 */
@Injectable({ providedIn: 'root' })
export class MediaPipeTasksService {
  private vision: any = null;
  private filesetPromise: Promise<any> | null = null;

  private fileset(): Promise<any> {
    if (!this.filesetPromise) {
      this.filesetPromise = (async () => {
        const vision = await new Function('url', 'return import(url)')(MEDIAPIPE_CDN);
        this.vision = vision;
        return vision.FilesetResolver.forVisionTasks(`${MEDIAPIPE_CDN}/wasm`);
      })();
    }
    return this.filesetPromise;
  }

  private async withDelegate<T>(create: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
    try {
      return await create('GPU');
    } catch {
      return create('CPU');
    }
  }

  async hand(): Promise<{ landmarker: any; drawingCtor: any; connections: any }> {
    const fileset = await this.fileset();
    const buffer = await this.getModelBuffer(HAND_LANDMARKER_URL);
    const landmarker = await this.withDelegate((delegate) =>
      this.vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: buffer, delegate },
        runningMode: 'VIDEO',
        numHands: 1,
      }),
    );
    return {
      landmarker,
      drawingCtor: this.vision.DrawingUtils,
      connections: this.vision.HandLandmarker.HAND_CONNECTIONS,
    };
  }

  async face(): Promise<any> {
    const fileset = await this.fileset();
    const buffer = await this.getModelBuffer(FACE_LANDMARKER_URL);
    return this.withDelegate((delegate) =>
      this.vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: buffer, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      }),
    );
  }

  async segmenter(): Promise<any> {
    const fileset = await this.fileset();
    const buffer = await this.getModelBuffer(SELFIE_SEGMENTER_URL);
    return this.withDelegate((delegate) =>
      this.vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: buffer, delegate },
        runningMode: 'VIDEO',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      }),
    );
  }

  private async getModelBuffer(url: string): Promise<Uint8Array> {
    const cached = await this.getCachedVisionModel(url);
    if (cached) return new Uint8Array(cached);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch vision model from ${url} (Status: ${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    try {
      await this.saveVisionModelToCache(url, buffer);
    } catch (e) {
      console.warn('Failed to cache vision model in IndexedDB:', e);
    }
    return new Uint8Array(buffer);
  }

  private openVisionDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(VISION_DB_NAME, VISION_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(VISION_STORE)) {
          db.createObjectStore(VISION_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getCachedVisionModel(url: string): Promise<ArrayBuffer | null> {
    try {
      const db = await this.openVisionDB();
      const tx = db.transaction(VISION_STORE, 'readonly');
      const request = tx.objectStore(VISION_STORE).get(url);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.buffer ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  private async saveVisionModelToCache(url: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.openVisionDB();
      const tx = db.transaction(VISION_STORE, 'readwrite');
      tx.objectStore(VISION_STORE).put({ buffer }, url);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

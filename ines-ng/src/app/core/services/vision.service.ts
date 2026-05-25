import { Injectable, signal } from '@angular/core';

export type DetectedEmotion = 'Neutral' | 'Happy' | 'Surprised' | 'Sad' | 'Thinking';
export type DetectedGesture =
  | 'None'
  | 'Open_Palm'
  | 'Closed_Fist'
  | 'Thumbs_Up'
  | 'Thumbs_Down'
  | 'Victory'
  | 'ILoveYou'
  | 'Pointing_Up';
export type GazeDirection = 'Center' | 'Left' | 'Right' | 'Up' | 'Down';

@Injectable({ providedIn: 'root' })
export class VisionService {
  readonly emotion = signal<DetectedEmotion>('Neutral');
  readonly emotionScores = signal<Record<string, number>>({});
  readonly gesture = signal<DetectedGesture>('None');
  readonly gestureScore = signal(0);
  readonly faceCount = signal(0);
  readonly gaze = signal<GazeDirection>('Center');
  readonly fps = signal(0);
  readonly isRunning = signal(false);

  // Face mesh data for canvas overlay (last detected face)
  private _landmarks: any[] = [];
  get faceLandmarks(): any[] {
    return this._landmarks;
  }

  private video: HTMLVideoElement | null = null;
  private faceLandmarker: any = null;
  private gestureRecognizer: any = null;
  private animationId: number | null = null;
  private frameCount = 0;
  private lastFpsTime = 0;

  async initVision(): Promise<void> {
    if (this.faceLandmarker && this.gestureRecognizer) return;

    try {
      const vision = await new Function('url', 'return import(url)')(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision',
      );
      const { FilesetResolver, FaceLandmarker, GestureRecognizer } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
      );

      this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 5,
      });

      this.gestureRecognizer = await GestureRecognizer.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
      });
    } catch (err) {
      console.error('Failed to init MediaPipe Vision:', err);
      throw err;
    }
  }

  async startWebcam(videoElement: HTMLVideoElement): Promise<void> {
    this.video = videoElement;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      this.video.srcObject = stream;
      this.video.addEventListener('loadeddata', () => {
        this.isRunning.set(true);
        this.lastFpsTime = performance.now();
        this.frameCount = 0;
        this.predict();
      });
    } catch (err) {
      console.error('Error accessing webcam:', err);
      throw err;
    }
  }

  stopWebcam(): void {
    this.isRunning.set(false);
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.video && this.video.srcObject) {
      const stream = this.video.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      this.video.srcObject = null;
    }
    this._landmarks = [];
    this.emotionScores.set({});
    this.gestureScore.set(0);
    this.fps.set(0);
  }

  private predict(): void {
    if (!this.isRunning() || !this.video || !this.faceLandmarker || !this.gestureRecognizer) return;

    const startTimeMs = performance.now();

    // --- FPS tracking ---
    this.frameCount++;
    const elapsed = startTimeMs - this.lastFpsTime;
    if (elapsed >= 500) {
      this.fps.set(Math.round((this.frameCount / elapsed) * 1000));
      this.frameCount = 0;
      this.lastFpsTime = startTimeMs;
    }

    // --- Face Landmarker ---
    const faceResults = this.faceLandmarker.detectForVideo(this.video, startTimeMs);
    const detected = faceResults.faceLandmarks ? faceResults.faceLandmarks.length : 0;
    this.faceCount.set(detected);

    if (detected > 0) {
      this._landmarks = faceResults.faceLandmarks[0];
      if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
        this.processBlendshapes(faceResults.faceBlendshapes[0].categories);
      }
    } else {
      this._landmarks = [];
      this.emotion.set('Neutral');
      this.emotionScores.set({});
    }

    // --- Gesture Recognizer ---
    const gestureResults = this.gestureRecognizer.recognizeForVideo(this.video, startTimeMs);
    if (gestureResults.gestures && gestureResults.gestures.length > 0) {
      const top = gestureResults.gestures[0][0];
      this.gesture.set(top.categoryName as DetectedGesture);
      this.gestureScore.set(Math.round(top.score * 100));
    } else {
      this.gesture.set('None');
      this.gestureScore.set(0);
    }

    this.animationId = requestAnimationFrame(() => this.predict());
  }

  private processBlendshapes(categories: any[]): void {
    const scores: Record<string, number> = {};
    for (const c of categories) {
      scores[c.categoryName] = c.score;
    }
    this.emotionScores.set(scores);

    // Emotion heuristics
    if ((scores['mouthSmileLeft'] ?? 0) > 0.4 || (scores['mouthSmileRight'] ?? 0) > 0.4) {
      this.emotion.set('Happy');
    } else if ((scores['browInnerUp'] ?? 0) > 0.3 && (scores['jawOpen'] ?? 0) > 0.2) {
      this.emotion.set('Surprised');
    } else if ((scores['browDownLeft'] ?? 0) > 0.3 || (scores['browDownRight'] ?? 0) > 0.3) {
      this.emotion.set('Thinking');
    } else if ((scores['mouthFrownLeft'] ?? 0) > 0.3 || (scores['mouthFrownRight'] ?? 0) > 0.3) {
      this.emotion.set('Sad');
    } else {
      this.emotion.set('Neutral');
    }

    // Gaze estimation from blendshapes
    const gLeft = scores['gazeLookingLeft'] ?? 0;
    const gRight = scores['gazeLookingRight'] ?? 0;
    const gUp = scores['gazeLookingUp'] ?? 0;
    const gDown = scores['gazeLookingDown'] ?? 0;
    const threshold = 0.15;
    if (gLeft > threshold && gLeft > gRight) this.gaze.set('Left');
    else if (gRight > threshold) this.gaze.set('Right');
    else if (gUp > threshold) this.gaze.set('Up');
    else if (gDown > threshold) this.gaze.set('Down');
    else this.gaze.set('Center');
  }
}

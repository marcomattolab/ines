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

export type FaceOverlayType =
  | 'photo'
  | 'pacman'
  | 'goku'
  | 'cat'
  | 'robot'
  | 'alien'
  | 'ninja'
  | 'joker'
  | 'sunglasses'
  | 'skull';

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
  readonly heartRate = signal(0);
  readonly engagement = signal(0);
  readonly handLandmarks = signal<any[][]>([]);
  readonly poseLandmarks = signal<any[]>([]);
  readonly handedness = signal<string[]>([]);

  private _landmarks: any[] = [];
  get faceLandmarks(): any[] {
    return this._landmarks;
  }

  private video: HTMLVideoElement | null = null;
  private faceLandmarker: any = null;
  private gestureRecognizer: any = null;
  private handLandmarker: any = null;
  private poseLandmarker: any = null;
  private filesetResolver: any = null;
  private animationId: number | null = null;
  private frameCount = 0;
  private lastFpsTime = 0;
  private _detectHands = false;
  private _detectPose = false;

  private intensities: number[] = [];
  private timestamps: number[] = [];
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  async initVision(): Promise<void> {
    if (this.faceLandmarker && this.gestureRecognizer) return;

    try {
      const vision = await new Function('url', 'return import(url)')(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision',
      );
      const { FilesetResolver, FaceLandmarker, GestureRecognizer } = vision;

      this.filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
      );

      this.faceLandmarker = await FaceLandmarker.createFromOptions(this.filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 5,
      });

      this.gestureRecognizer = await GestureRecognizer.createFromOptions(this.filesetResolver, {
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

  async enableHandDetection(enabled: boolean): Promise<void> {
    this._detectHands = enabled;
    if (enabled && !this.handLandmarker && this.filesetResolver) {
      try {
        const vision = await new Function('url', 'return import(url)')(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision',
        );
        const { HandLandmarker } = vision;
        this.handLandmarker = await HandLandmarker.createFromOptions(this.filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      } catch (err) {
        console.error('Failed to init HandLandmarker:', err);
        this._detectHands = false;
      }
    }
    if (!enabled) {
      this.handLandmarks.set([]);
      this.handedness.set([]);
    }
  }

  async enablePoseDetection(enabled: boolean): Promise<void> {
    this._detectPose = enabled;
    if (enabled && !this.poseLandmarker && this.filesetResolver) {
      try {
        const vision = await new Function('url', 'return import(url)')(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision',
        );
        const { PoseLandmarker } = vision;
        this.poseLandmarker = await PoseLandmarker.createFromOptions(this.filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
        });
      } catch (err) {
        console.error('Failed to init PoseLandmarker:', err);
        this._detectPose = false;
      }
    }
    if (!enabled) {
      this.poseLandmarks.set([]);
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
    this.handLandmarks.set([]);
    this.poseLandmarks.set([]);
    this.handedness.set([]);
  }

  private predict(): void {
    if (!this.isRunning() || !this.video || !this.faceLandmarker || !this.gestureRecognizer) return;

    const startTimeMs = performance.now();
    const videoWidth = this.video.videoWidth;
    const videoHeight = this.video.videoHeight;

    if (!videoWidth || !videoHeight) {
      this.animationId = requestAnimationFrame(() => this.predict());
      return;
    }

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
      this.estimateVitals(this._landmarks, videoWidth, videoHeight);
      this.calculateEngagement();
    } else {
      this._landmarks = [];
      this.emotion.set('Neutral');
      this.emotionScores.set({});
      this.heartRate.set(0);
      this.engagement.set(0);
      this.intensities = [];
      this.timestamps = [];
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

    // --- Hand Landmarker ---
    if (this.handLandmarker && this._detectHands) {
      const handResults = this.handLandmarker.detectForVideo(this.video, startTimeMs);
      if (handResults.landmarks && handResults.landmarks.length > 0) {
        this.handLandmarks.set(handResults.landmarks);
        this.handedness.set(
          handResults.handedness
            ? handResults.handedness.map((h: any) => h[0]?.categoryName || 'Unknown')
            : [],
        );
      } else {
        this.handLandmarks.set([]);
        this.handedness.set([]);
      }
    }

    // --- Pose Landmarker ---
    if (this.poseLandmarker && this._detectPose) {
      const poseResults = this.poseLandmarker.detectForVideo(this.video, startTimeMs);
      if (poseResults.landmarks && poseResults.landmarks.length > 0) {
        this.poseLandmarks.set(poseResults.landmarks[0]);
      } else {
        this.poseLandmarks.set([]);
      }
    }

    this.animationId = requestAnimationFrame(() => this.predict());
  }

  private estimateVitals(landmarks: any[], w: number, h: number): void {
    // We use a small area on the forehead (landmarks around index 10)
    const forehead = landmarks[10];
    if (!forehead) return;

    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = 10;
      this.offscreenCanvas.height = 10;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    const ctx = this.offscreenCtx;
    if (!ctx) return;

    // Sample a 20x20 area around the forehead
    const sampleSize = 20;
    const sx = forehead.x * w - sampleSize / 2;
    const sy = forehead.y * h - sampleSize / 2;

    ctx.drawImage(this.video!, sx, sy, sampleSize, sampleSize, 0, 0, 10, 10);
    const data = ctx.getImageData(0, 0, 10, 10).data;

    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const avgG = g / (data.length / 4);

    const now = performance.now();
    this.intensities.push(avgG);
    this.timestamps.push(now);

    // Keep 4 seconds of data (approx 120 frames at 30fps)
    if (this.intensities.length > 150) {
      this.intensities.shift();
      this.timestamps.shift();
    }

    if (this.intensities.length > 60) {
      this.calculateBPM();
    }
  }

  private calculateBPM(): void {
    // Simple peak counting on the green channel variance
    // In a real app, we'd use Bandpass filter + FFT
    let peaks = 0;
    const data = this.intensities;
    const windowSize = 5;

    // Moving average to smooth
    const smoothed = [];
    for (let i = windowSize; i < data.length - windowSize; i++) {
      let sum = 0;
      for (let j = -windowSize; j <= windowSize; j++) sum += data[i + j];
      smoothed.push(sum / (windowSize * 2 + 1));
    }

    // Count peaks
    for (let i = 1; i < smoothed.length - 1; i++) {
      if (smoothed[i] > smoothed[i - 1] && smoothed[i] > smoothed[i + 1]) {
        peaks++;
      }
    }

    const durationSec = (this.timestamps[this.timestamps.length - 1] - this.timestamps[0]) / 1000;
    const bpm = Math.round((peaks / durationSec) * 60);

    // Realistic human range 60-100 for rest
    if (bpm > 50 && bpm < 120) {
      // Smooth the signal
      const current = this.heartRate();
      this.heartRate.set(current === 0 ? bpm : Math.round(current * 0.9 + bpm * 0.1));
    }
  }

  private calculateEngagement(): void {
    let score = 0;

    // Face present
    if (this.faceCount() > 0) score += 40;

    // Gaze direction
    if (this.gaze() === 'Center') score += 40;
    else score += 10;

    // Emotion - positive/active emotions boost engagement
    const e = this.emotion();
    if (e === 'Happy' || e === 'Thinking') score += 20;
    else if (e === 'Surprised') score += 10;
    else score += 5;

    const current = this.engagement();
    this.engagement.set(Math.round(current * 0.8 + score * 0.2));
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

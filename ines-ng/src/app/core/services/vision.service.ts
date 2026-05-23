import { Injectable, signal, computed } from '@angular/core';

export type DetectedEmotion = 'Neutral' | 'Happy' | 'Surprised' | 'Sad' | 'Thinking';
export type DetectedGesture = 'None' | 'Open_Palm' | 'Closed_Fist' | 'Thumbs_Up' | 'Thumbs_Down' | 'Victory' | 'ILoveYou' | 'Pointing_Up';

@Injectable({ providedIn: 'root' })
export class VisionService {
  readonly emotion = signal<DetectedEmotion>('Neutral');
  readonly gesture = signal<DetectedGesture>('None');
  readonly faceCount = signal(0);
  readonly isRunning = signal(false);

  private video: HTMLVideoElement | null = null;
  private faceLandmarker: any = null;
  private gestureRecognizer: any = null;
  private animationId: number | null = null;

  async initVision(): Promise<void> {
    if (this.faceLandmarker && this.gestureRecognizer) return;

    try {
      const vision = await new Function('url', 'return import(url)')(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision'
      );
      const { FilesetResolver, FaceLandmarker, GestureRecognizer } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );

      this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 5
      });

      this.gestureRecognizer = await GestureRecognizer.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO"
      });

    } catch (err) {
      console.error('Failed to init MediaPipe Vision:', err);
      throw err;
    }
  }

  async startWebcam(videoElement: HTMLVideoElement): Promise<void> {
    this.video = videoElement;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      this.video.srcObject = stream;
      this.video.addEventListener('loadeddata', () => {
        this.isRunning.set(true);
        this.predict();
      });
    } catch (err) {
      console.error('Error accessing webcam:', err);
      throw err;
    }
  }

  stopWebcam(): void {
    this.isRunning.set(false);
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.video && this.video.srcObject) {
      const stream = this.video.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      this.video.srcObject = null;
    }
  }

  private predict(): void {
    if (!this.isRunning() || !this.video || !this.faceLandmarker || !this.gestureRecognizer) return;

    const startTimeMs = performance.now();

    // Face Landmarker
    const faceResults = this.faceLandmarker.detectForVideo(this.video, startTimeMs);
    this.faceCount.set(faceResults.faceLandmarks ? faceResults.faceLandmarks.length : 0);

    if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
      this.processEmotions(faceResults.faceBlendshapes[0].categories);
    }

    // Gesture Recognizer
    const gestureResults = this.gestureRecognizer.recognizeForVideo(this.video, startTimeMs);
    if (gestureResults.gestures && gestureResults.gestures.length > 0) {
      const topGesture = gestureResults.gestures[0][0].categoryName as DetectedGesture;
      this.gesture.set(topGesture);
    } else {
      this.gesture.set('None');
    }

    this.animationId = requestAnimationFrame(() => this.predict());
  }

  private processEmotions(categories: any[]): void {
    const scores: Record<string, number> = {};
    for (const c of categories) {
      scores[c.categoryName] = c.score;
    }

    // Simple heuristic-based emotion detection
    if (scores['eyeBlinkLeft'] > 0.5 && scores['eyeBlinkRight'] > 0.5) {
      // maybe blinking or closed eyes
    }

    if (scores['mouthSmileLeft'] > 0.4 || scores['mouthSmileRight'] > 0.4) {
      this.emotion.set('Happy');
    } else if (scores['browInnerUp'] > 0.3 && scores['jawOpen'] > 0.2) {
      this.emotion.set('Surprised');
    } else if (scores['browDownLeft'] > 0.3 || scores['browDownRight'] > 0.3) {
      this.emotion.set('Thinking');
    } else if (scores['mouthFrownLeft'] > 0.3 || scores['mouthFrownRight'] > 0.3) {
      this.emotion.set('Sad');
    } else {
      this.emotion.set('Neutral');
    }
  }
}

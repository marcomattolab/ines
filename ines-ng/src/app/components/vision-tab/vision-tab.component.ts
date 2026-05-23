import { Component, inject, signal, viewChild, ElementRef, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { VisionService } from '../../core/services/vision.service';
import { AgentService } from '../../core/services/agent.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-vision-tab',
  standalone: true,
  imports: [CommonModule, MatIconModule, ButtonComponent],
  templateUrl: './vision-tab.component.html',
  styleUrl: './vision-tab.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class VisionTabComponent implements OnDestroy {
  vision = inject(VisionService);
  agentSvc = inject(AgentService);
  toast = inject(ToastService);

  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  isInitializing = signal(false);
  adaptiveMode = signal(false);
  gestureControl = signal(false);
  notifications = signal<{ id: number; icon: string; msg: string; type: string; time: string }[]>([]);

  private lastGesture = 'None';
  private lastFaceCount = 0;
  private nextNotifyId = 1;

  constructor() {
    // Gesture Logic Effect
    effect(() => {
      if (!this.gestureControl()) return;
      const g = this.vision.gesture();
      if (g !== 'None' && g !== this.lastGesture) {
        const icons: any = { Open_Palm: 'back_hand', Thumbs_Up: 'thumb_up', Thumbs_Down: 'thumb_down' };
        this.addNotification(icons[g] || 'gesture', `Gesture detected: ${g.replace('_', ' ')}`, 'purple');
        this.lastGesture = g;
      } else if (g === 'None') {
        this.lastGesture = 'None';
      }
    });

    // Emotion Logic Effect
    effect(() => {
      if (!this.adaptiveMode()) return;
      const e = this.vision.emotion();
      if (e !== 'Neutral') {
        const icons: any = { Thinking: 'psychology', Surprised: 'priority_high', Happy: 'sentiment_very_satisfied', Sad: 'sentiment_very_dissatisfied' };
        this.addNotification(icons[e] || 'face', `Emotion sensed: ${e}`, 'blue');
      }
    });

    // Face Count Effect
    effect(() => {
      const count = this.vision.faceCount();
      if (count !== this.lastFaceCount) {
        if (count > this.lastFaceCount) {
          this.addNotification('group', `${count} face(s) in view`, 'green');
        }
        this.lastFaceCount = count;
      }
    });
  }

  private addNotification(icon: string, msg: string, type: string) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.notifications.update(n => [{ id: this.nextNotifyId++, icon, msg, type, time }, ...n].slice(0, 50));
  }

  async toggleVision() {
    if (this.vision.isRunning()) {
      this.vision.stopWebcam();
    } else {
      this.isInitializing.set(true);
      try {
        await this.vision.initVision();
        if (this.videoEl()) {
          await this.vision.startWebcam(this.videoEl()!.nativeElement);
        }
      } catch (err) {
        this.toast.show('❌ Failed to start Vision: ' + err);
      } finally {
        this.isInitializing.set(false);
      }
    }
  }

  ngOnDestroy() {
    this.vision.stopWebcam();
  }
}

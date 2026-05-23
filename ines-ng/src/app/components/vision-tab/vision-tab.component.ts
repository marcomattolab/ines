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

  private lastGesture = 'None';

  constructor() {
    // Gesture Logic Effect
    effect(() => {
      if (!this.gestureControl()) return;
      const g = this.vision.gesture();
      if (g !== this.lastGesture) {
        if (g === 'Open_Palm') {
          this.toast.show('✋ Gesture detected: Open Palm (Pause Command)');
        } else if (g === 'Thumbs_Up') {
          this.toast.show('👍 Gesture detected: Thumbs Up (Approval)');
        }
        this.lastGesture = g;
      }
    });

    // Emotion Logic Effect
    effect(() => {
      if (!this.adaptiveMode()) return;
      const e = this.vision.emotion();
      if (e === 'Thinking') {
        this.toast.show('🤔 You look like you are thinking. Should I provide more detailed explanations?');
      } else if (e === 'Surprised') {
        this.toast.show('😲 Something surprised you? Need more context?');
      }
    });
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

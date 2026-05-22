import { Component, inject, signal, OnDestroy, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { SpeechService } from '../../core/services/speech.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

const SYSTEM_MEETING = `You are a specialist assistant for analyzing corporate meetings.
Given a transcript of a meeting, produce:
1. **KEY POINTS** (3-6 bullet points of the topics discussed)
2. **DECISIONS MADE** (what was decided)
3. **ACTION ITEMS** (who must do what, if available)
4. **NEXT STEPS**

Be concise and use the language of the transcript. Format the result clearly.`;

@Component({
  selector: 'app-meeting-tab',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './meeting-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
  styleUrl: './meeting-tab.css',
})
export class MeetingTabComponent implements OnDestroy {
  llm = inject(LlmService);
  toast = inject(ToastService);
  speech = inject(SpeechService);

  transcript = signal('');
  summary = signal('');
  recording = signal(false);
  timerText = signal('');

  readonly isTranscriptSpeaking = computed(
    () => this.speech.speaking() && this.speech.activeId() === 'meet-trans',
  );
  readonly isSummarySpeaking = computed(
    () => this.speech.speaking() && this.speech.activeId() === 'meet-sum',
  );

  toggleSpeakTranscript() {
    this.speech.toggle('meet-trans', this.transcript());
  }

  toggleSpeakSummary() {
    this.speech.toggle('meet-sum', this.summary());
  }

  private recognition: any = null;
  private fullTranscript = '';
  private seconds = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  toggleRecording() {
    this.recording() ? this.stopRecording() : this.startRecording();
  }

  startRecording() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      this.toast.show('⚠️ Web Speech API not supported in this browser');
      return;
    }

    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = navigator.language || 'en-US';

    this.recognition.onresult = (e: any) => {
      let interim = '',
        final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      if (final) this.fullTranscript += final;
      this.transcript.set(this.fullTranscript + (interim ? `[${interim}]` : ''));
    };

    this.recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') this.toast.show('⚠️ Mic error: ' + e.error);
    };

    this.recognition.onend = () => {
      if (this.recording() && this.recognition) this.recognition.start();
    };

    this.recognition.start();
    this.recording.set(true);
    this.seconds = 0;

    this.intervalId = setInterval(() => {
      this.seconds++;
      const m = Math.floor(this.seconds / 60)
        .toString()
        .padStart(2, '0');
      const s = (this.seconds % 60).toString().padStart(2, '0');
      this.timerText.set(`⏱ ${m}:${s}`);
    }, 1000);
  }

  stopRecording() {
    if (this.recognition) {
      this.recording.set(false);
      this.recognition.stop();
      this.recognition = null;
    } else {
      this.recording.set(false);
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.fullTranscript.trim() && this.llm.isReady()) {
      setTimeout(() => this.summarize(), 500);
    }
  }

  async summarize() {
    const text = this.fullTranscript.trim() || this.transcript().trim();
    if (!text) {
      this.toast.show('⚠️ No transcript available');
      return;
    }
    if (!this.llm.isReady()) {
      this.toast.show('⚠️ Load the model first!');
      return;
    }

    this.summary.set('...');
    const prompt = this.llm.buildPrompt(SYSTEM_MEETING, `TRANSCRIPT OF THE MEETING:\n${text}`);
    try {
      await this.llm.generate(prompt, (_, done, full) =>
        this.summary.set(full + (done ? '' : ' ▋')),
      );
    } catch (e: any) {
      this.summary.set('❌ ' + e.message);
    }
  }

  clear() {
    this.fullTranscript = '';
    this.transcript.set('');
    this.summary.set('');
    this.timerText.set('');
  }

  copy(text: string) {
    navigator.clipboard.writeText(text).then(() => this.toast.show('📋 Copied!'));
  }

  ngOnDestroy() {
    this.stopRecording();
  }
}

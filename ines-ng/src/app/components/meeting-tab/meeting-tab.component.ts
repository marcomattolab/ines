import { Component, inject, signal, OnDestroy } from '@angular/core';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';

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
  template: `
    <div class="tab-panel-inner">
      <div class="panel-header">
        <div>
          <div class="panel-title"><span class="panel-title-icon">🎙️</span> Meeting Recorder</div>
          <div class="panel-desc">Vocal transcription + AI-generated summary</div>
        </div>
        <button class="pill-btn" (click)="clear()">🗑 Clear</button>
      </div>

      <div class="meeting-layout">
        <div class="meeting-transcript">
          <div class="meeting-pane-label">
            <span>📝 TRANSCRIPTION</span>
            <button class="pill-btn" style="font-size:10px" (click)="copy(transcript())">📋</button>
          </div>
          <div class="meeting-scroll">{{ transcript() }}</div>
        </div>
        <div class="meeting-summary">
          <div class="meeting-pane-label">
            <span>✨ AI SUMMARY</span>
            <button class="pill-btn" style="font-size:10px" (click)="copy(summary())">📋</button>
          </div>
          <div class="meeting-scroll">
            @if (summary()) {
              {{ summary() }}
            } @else {
              <div class="empty-state" style="height:100%">
                <div class="empty-icon">🤖</div>
                <div class="empty-text">The summary will appear automatically after stopping the recording</div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="meeting-controls">
        <button class="record-btn" [class.recording]="recording()" (click)="toggleRecording()">
          <div class="record-dot"></div>
          <span>{{ recording() ? 'Stop Recording' : 'Start Recording' }}</span>
        </button>
        <span class="timer-text">{{ timerText() }}</span>
        <div style="flex:1"></div>
        <button class="pill-btn" (click)="summarize()">✨ Summarize Now</button>
      </div>
    </div>
  `,
  styleUrl: './meeting-tab.css'
})
export class MeetingTabComponent implements OnDestroy {
  llm   = inject(LlmService);
  toast = inject(ToastService);

  transcript = signal('');
  summary    = signal('');
  recording  = signal(false);
  timerText  = signal('');

  private recognition: any = null;
  private fullTranscript = '';
  private seconds = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  toggleRecording() {
    this.recording() ? this.stopRecording() : this.startRecording();
  }

  startRecording() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { this.toast.show('⚠️ Web Speech API not supported in this browser'); return; }

    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = navigator.language || 'en-US';

    this.recognition.onresult = (e: any) => {
      let interim = '', final = '';
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
      if (this.recording()) this.recognition.start();
    };

    this.recognition.start();
    this.recording.set(true);
    this.seconds = 0;

    this.intervalId = setInterval(() => {
      this.seconds++;
      const m = Math.floor(this.seconds / 60).toString().padStart(2, '0');
      const s = (this.seconds % 60).toString().padStart(2, '0');
      this.timerText.set(`⏱ ${m}:${s}`);
    }, 1000);
  }

  stopRecording() {
    if (this.recognition) { this.recognition.stop(); this.recognition = null; }
    this.recording.set(false);
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    if (this.fullTranscript.trim() && this.llm.isReady()) {
      setTimeout(() => this.summarize(), 500);
    }
  }

  async summarize() {
    const text = this.fullTranscript.trim() || this.transcript().trim();
    if (!text) { this.toast.show('⚠️ No transcript available'); return; }
    if (!this.llm.isReady()) { this.toast.show('⚠️ Load the model first!'); return; }

    this.summary.set('...');
    const prompt = this.llm.buildPrompt(SYSTEM_MEETING, `TRANSCRIPT OF THE MEETING:\n${text}`);
    try {
      await this.llm.generate(prompt, (_, done, full) => this.summary.set(full + (done ? '' : ' ▋')));
    } catch(e: any) {
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

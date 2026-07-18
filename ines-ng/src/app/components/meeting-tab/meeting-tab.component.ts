import { Component, inject, signal, OnDestroy, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { SpeechService } from '../../core/services/speech.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
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
  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  readonly speech = inject(SpeechService);
  private readonly dom = inject(DomUtilsService);

  transcript = signal('');
  summary = signal('');

  readonly isTranscriptSpeaking = computed(
    () => this.speech.speaking() && this.speech.activeId() === 'meet-trans',
  );
  readonly isSummarySpeaking = computed(
    () => this.speech.speaking() && this.speech.activeId() === 'meet-sum',
  );
  readonly recording = this.speech.recording;
  readonly timerText = this.speech.recordingTimer;

  toggleSpeakTranscript() {
    this.speech.toggle('meet-trans', this.transcript());
  }

  toggleSpeakSummary() {
    this.speech.toggle('meet-sum', this.summary());
  }

  toggleRecording() {
    this.speech.recording() ? this.stopRecording() : this.startRecording();
  }

  startRecording() {
    const ok = this.speech.startRecording(this.transcript(), (text) => this.transcript.set(text));
    if (!ok) {
      this.toast.show('⚠️ Web Speech API not supported in this browser');
    }
  }

  stopRecording() {
    this.speech.stopRecording();
    if (this.transcript().trim() && this.llm.isReady()) {
      setTimeout(() => this.summarize(), 500);
    }
  }

  async summarize() {
    const text = this.transcript().trim();
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
    this.transcript.set('');
    this.summary.set('');
  }

  copy(text: string) {
    this.dom.copyToClipboard(text).then(() => this.toast.show('📋 Copied!'));
  }

  exportSummary(fmt: 'md' | 'txt') {
    const text = this.summary().replace(/ ▋$/, '');
    if (!text.trim()) {
      this.toast.show('⚠️ No summary to export');
      return;
    }
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const transcript = this.transcript().replace(/ ▋$/, '');
    const lines = [
      fmt === 'md' ? '# Meeting Summary' : 'MEETING SUMMARY',
      fmt === 'md' ? '' : '———————',
      `Date: ${new Date().toLocaleString()}`,
      '',
      fmt === 'md' ? '## Summary' : 'SUMMARY:',
      text,
      '',
      fmt === 'md' ? '---' : '———————',
      fmt === 'md' ? '## Full Transcript' : 'FULL TRANSCRIPT:',
      transcript || '(no transcript)',
      '',
      fmt === 'md' ? '_Exported from INES_' : 'Exported from INES',
    ];
    this.dom.downloadText(lines.join('\n'), `meeting-summary-${ts}.${fmt}`);
    this.toast.show(`📄 Exported as .${fmt}`);
  }

  ngOnDestroy() {
    this.speech.abortRecording();
  }
}

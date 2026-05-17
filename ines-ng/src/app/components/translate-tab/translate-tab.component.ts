import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { SpeechService } from '../../core/services/speech.service';

const SYSTEM_TRANSLATE = `You are a professional translator.
Translate the given text EXACTLY as requested, preserving style, tone and formatting.
Respond ONLY with the translated text, without explanations, without indicating the language, without adding anything else.`;

const LANGUAGES = [
  { value: 'Italian',    label: '🇮🇹 Italiano' },
  { value: 'English',    label: '🇬🇧 English' },
  { value: 'French',     label: '🇫🇷 Français' },
  { value: 'German',     label: '🇩🇪 Deutsch' },
  { value: 'Spanish',    label: '🇪🇸 Español' },
  { value: 'Portuguese', label: '🇵🇹 Português' },
  { value: 'Chinese',    label: '🇨🇳 中文' },
  { value: 'Japanese',   label: '🇯🇵 日本語' },
  { value: 'Arabic',     label: '🇸🇦 العربية' },
  { value: 'Russian',    label: '🇷🇺 Русский' },
];

@Component({
  selector: 'app-translate-tab',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './translate-tab.component.html',
  styleUrl: './translate-tab.css'
})
export class TranslateTabComponent {
  llm   = inject(LlmService);
  toast = inject(ToastService);
  speech = inject(SpeechService);

  languages = LANGUAGES;
  fromLang  = 'auto';
  toLang    = 'English';
  inputText = '';
  result    = signal('');
  translating = signal(false);

  readonly isSourceSpeaking = computed(() => this.speech.speaking() && this.speech.activeId() === 'trans-source');
  readonly isResultSpeaking = computed(() => this.speech.speaking() && this.speech.activeId() === 'trans-result');

  toggleSpeakSource() {
    this.speech.toggle('trans-source', this.inputText, this.fromLang === 'auto' ? navigator.language : this.fromLang);
  }

  toggleSpeakResult() {
    this.speech.toggle('trans-result', this.result(), this.toLang);
  }

  private debounce: ReturnType<typeof setTimeout> | null = null;

  onInput() {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      if (this.inputText.length > 10 && this.llm.isReady()) this.translate();
    }, 1200);
  }

  async translate() {
    if (!this.inputText.trim()) return;
    if (!this.llm.isReady()) { this.toast.show('⚠️ Load the model first!'); return; }

    const srcDesc = this.fromLang === 'auto' ? 'detected language' : this.fromLang;
    const instruction = `Translate the following text from ${srcDesc} to ${this.toLang}:\n\n${this.inputText}`;
    const prompt = this.llm.buildPrompt(SYSTEM_TRANSLATE, instruction);

    this.translating.set(true);
    this.result.set(' ');
    try {
      await this.llm.generate(prompt, (_, done, full) => {
        this.result.set(full);
        this.translating.set(!done);
      });
    } catch(e: any) {
      this.result.set('❌ ' + e.message);
      this.translating.set(false);
    }
  }

  swap() {
    if (this.fromLang !== 'auto') {
      const tmp = this.fromLang;
      this.fromLang = this.toLang;
      this.toLang = tmp;
    }
    const prevResult = this.result();
    this.inputText = prevResult;
    this.result.set('');
    if (prevResult.length > 3) this.translate();
  }

  copy() {
    navigator.clipboard.writeText(this.result()).then(() => this.toast.show('📋 Copied!'));
  }

  clear() {
    this.inputText = '';
    this.result.set('');
  }

  resultHtml() {
    return this.result()
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }
}

import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { SpeechService } from '../../core/services/speech.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';

const SYSTEM_TRANSLATE = `You are a professional translator.
Translate the given text EXACTLY as requested, preserving style, tone and formatting.
Respond ONLY with the translated text, without explanations, without indicating the language, without adding anything else.`;

const LANGUAGES = [
  { value: 'Italian', label: '🇮🇹 Italiano' },
  { value: 'English', label: '🇬🇧 English' },
  { value: 'French', label: '🇫🇷 Français' },
  { value: 'German', label: '🇩🇪 Deutsch' },
  { value: 'Spanish', label: '🇪🇸 Español' },
  { value: 'Portuguese', label: '🇵🇹 Português' },
  { value: 'Chinese', label: '🇨🇳 中文' },
  { value: 'Japanese', label: '🇯🇵 日本語' },
  { value: 'Arabic', label: '🇸🇦 العربية' },
  { value: 'Russian', label: '🇷🇺 Русский' },
];

@Component({
  selector: 'app-translate-tab',
  standalone: true,
  imports: [FormsModule, MatIconModule, ButtonComponent, DropdownComponent],
  templateUrl: './translate-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class TranslateTabComponent implements OnDestroy {
  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  readonly speech = inject(SpeechService);
  private readonly dom = inject(DomUtilsService);

  languages = LANGUAGES;

  readonly fromLangOptions = computed(() => [
    { value: 'auto', label: 'Auto-detect', icon: 'auto_awesome' },
    ...this.languages.map((l) => ({ value: l.value, label: l.label })),
  ]);

  readonly toLangOptions = computed(() =>
    this.languages.map((l) => ({ value: l.value, label: l.label })),
  );

  fromLang = signal('auto');
  toLang = signal('English');
  inputText = signal('');
  result = signal('');
  translating = signal(false);

  readonly isSourceSpeaking = computed(
    () => this.speech.speaking() && this.speech.activeId() === 'trans-source',
  );
  readonly isResultSpeaking = computed(
    () => this.speech.speaking() && this.speech.activeId() === 'trans-result',
  );

  toggleSpeakSource() {
    this.speech.toggle(
      'trans-source',
      this.inputText(),
      this.fromLang() === 'auto' ? navigator.language : this.fromLang(),
    );
  }

  toggleSpeakResult() {
    this.speech.toggle('trans-result', this.result(), this.toLang());
  }

  private debounce: ReturnType<typeof setTimeout> | null = null;

  onInput(val: string) {
    this.inputText.set(val);
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      if (this.inputText().length > 10 && this.llm.isReady()) this.translate();
    }, 1200);
  }

  async translate() {
    if (!this.inputText().trim()) return;
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }

    const srcDesc = this.fromLang() === 'auto' ? 'detected language' : this.fromLang();
    const instruction = `Translate the following text from ${srcDesc} to ${this.toLang()}:\n\n${this.inputText()}`;
    const prompt = this.llm.buildPrompt(SYSTEM_TRANSLATE, instruction);

    this.translating.set(true);
    this.result.set(' ');
    try {
      await this.llm.generate(prompt, (_, done, full) => {
        this.result.set(full);
        this.translating.set(!done);
      });
    } catch (e: any) {
      const msg = e.message?.includes('INVALID_ARGUMENT')
        ? 'Text too long for the model.'
        : e.message;
      this.result.set(msg);
      this.translating.set(false);
    }
  }

  swap() {
    if (this.fromLang() === 'auto') return;
    const tmp = this.fromLang();
    this.fromLang.set(this.toLang());
    this.toLang.set(tmp);
    const prevResult = this.result();
    this.inputText.set(prevResult);
    this.result.set('');
    if (prevResult.length > 3) this.translate();
  }

  copy() {
    this.dom.copyToClipboard(this.result()).then(() => this.toast.success('Copied!'));
  }

  clear() {
    this.inputText.set('');
    this.result.set('');
  }

  resultHtml() {
    return this.dom.escapeHtml(this.result());
  }

  ngOnDestroy() {
    if (this.debounce) {
      clearTimeout(this.debounce);
      this.debounce = null;
    }
  }
}

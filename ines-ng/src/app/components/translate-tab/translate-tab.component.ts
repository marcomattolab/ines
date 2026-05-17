import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';

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
  template: `
    <div class="tab-panel-inner">
      <div class="panel-header">
        <div>
          <div class="panel-title"><span class="panel-title-icon">🌍</span> Translator</div>
          <div class="panel-desc">Translate text between any language — completely offline</div>
        </div>
      </div>

      <div class="translate-pair">
        <div class="translate-side">
          <div class="translate-lang-bar">
            <select class="pill-select" style="flex:1" [(ngModel)]="fromLang">
              <option value="auto">🔍 Auto-detect language</option>
              @for (lang of languages; track lang.value) {
                <option [value]="lang.value">{{ lang.label }}</option>
              }
            </select>
          </div>
          <textarea class="translate-textarea"
            placeholder="Text to translate..."
            [(ngModel)]="inputText"
            (input)="onInput()"></textarea>
        </div>

        <div class="translate-side">
          <div class="translate-lang-bar">
            <button class="swap-btn" title="Swap languages" (click)="swap()">⇄</button>
            <select class="pill-select" style="flex:1" [(ngModel)]="toLang">
              @for (lang of languages; track lang.value) {
                <option [value]="lang.value">{{ lang.label }}</option>
              }
            </select>
            <button class="pill-btn" style="font-size:10px" (click)="copy()">📋</button>
          </div>
          <div class="translate-result-area">
            @if (result()) {
              <span [class.cursor-blink]="translating()" [innerHTML]="resultHtml()"></span>
            } @else {
              <span style="color:var(--text-2)">The translation will appear here...</span>
            }
          </div>
        </div>
      </div>

      <div class="translate-bar">
        <button class="send-btn" style="width:auto;padding:0 18px;border-radius:var(--radius-sm)"
          (click)="translate()">🌍 Translate</button>
        <button class="pill-btn" (click)="clear()">🗑 Clear</button>
      </div>
    </div>
  `,
  styleUrl: './translate-tab.css'
})
export class TranslateTabComponent {
  llm   = inject(LlmService);
  toast = inject(ToastService);

  languages = LANGUAGES;
  fromLang  = 'auto';
  toLang    = 'English';
  inputText = '';
  result    = signal('');
  translating = signal(false);

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

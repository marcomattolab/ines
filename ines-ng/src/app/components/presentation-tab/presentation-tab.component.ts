import {
  Component,
  inject,
  signal,
  computed,
  Signal,
  viewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

type ColorTheme = 'professional' | 'ocean' | 'forest' | 'sunset' | 'monochrome';

const COLOR_THEMES: Record<ColorTheme, { primary: string; secondary: string; accent: string }> = {
  professional: { primary: '#3b82f6', secondary: '#1e293b', accent: '#60a5fa' },
  ocean: { primary: '#06b6d4', secondary: '#0f172a', accent: '#22d3ee' },
  forest: { primary: '#10b981', secondary: '#1a2e1a', accent: '#34d399' },
  sunset: { primary: '#f97316', secondary: '#2d1b0e', accent: '#fb923c' },
  monochrome: { primary: '#94a3b8', secondary: '#0f111a', accent: '#cbd5e1' },
};

const SYSTEM_PPT = `You are a professional presentation designer. Generate a complete, self-contained HTML slide deck.

RULES:
- Output ONLY valid HTML (no markdown fences, no explanations).
- Use <section class="slide"> for each slide.
- Include all CSS in a <style> tag inside the HTML.
- Include JS for keyboard navigation (ArrowLeft/ArrowRight), dot indicators, and page numbers.
- Each slide must have a data-slide-number attribute.
- Design must be modern, dark-themed, with glassmorphism effects.
- Use the colors specified in the branding variables below.
- Include the logo text, author, and contact info on appropriate slides.
- Make it responsive and professional.
- Slide 1 = Title slide with logo, title, author.
- Last slide = Thank you / contact slide with the contact info.
- Total slides: 8-12 depending on content depth.

Branding to embed:
- Logo: {LOGO}
- Author: {AUTHOR}
- Contact: {CONTACT}
- Primary color: {PRIMARY}
- Secondary color: {SECONDARY}
- Accent color: {ACCENT}

Topic: {TOPIC}`;

@Component({
  selector: 'app-presentation-tab',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './presentation-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
  styleUrl: './presentation-tab.component.css',
})
export class PresentationTabComponent implements AfterViewInit, OnDestroy {
  private sanitizer = inject(DomSanitizer);
  llm = inject(LlmService);
  toast = inject(ToastService);

  readonly previewFrame = viewChild.required<ElementRef<HTMLIFrameElement>>('previewFrame');

  prompt = signal('Create a presentation about AI and machine learning trends in 2026');
  generating = signal(false);
  slideCount = signal(0);
  currentSlide = signal(0);
  generatedHtml = signal<string>('');
  brandingOpen = signal(false);

  logo = signal('✦ INES');
  author = signal('Marco Martorana');
  contact = signal('hello@ines.ai · ines.ai');
  colorTheme = signal<ColorTheme>('professional');
  customPrimary = signal('#3b82f6');

  readonly safeHtml: Signal<SafeHtml> = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.generatedHtml()),
  );

  private resizeHandler: (() => void) | null = null;
  private isResizing = false;

  readonly themeColors = COLOR_THEMES;
  readonly themes: ColorTheme[] = ['professional', 'ocean', 'forest', 'sunset', 'monochrome'];

  ngAfterViewInit() {
    this.syncIframeHeight();
  }

  ngOnDestroy() {
    this.removeResizeListeners();
  }

  private syncIframeHeight() {
    const iframe = this.previewFrame()?.nativeElement;
    if (!iframe) return;
    const sync = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          const h = doc.body.scrollHeight;
          if (h > 0 && iframe.style.height !== h + 'px') {
            iframe.style.height = h + 'px';
          }
        }
      } catch (_) {}
    };
    iframe.addEventListener('load', sync);
    this.resizeHandler = sync;
  }

  async generate() {
    if (this.generating()) return;
    if (!this.llm.isReady()) {
      this.toast.show('⚠️ Load the model first!');
      return;
    }

    this.generating.set(true);
    this.generatedHtml.set('');
    this.slideCount.set(0);
    this.currentSlide.set(0);
    this.toast.show('⏳ Generating presentation...');

    const theme = this.colorTheme();
    const colors =
      theme === 'professional'
        ? {
            primary: this.customPrimary(),
            secondary: COLOR_THEMES[theme].secondary,
            accent: COLOR_THEMES[theme].accent,
          }
        : COLOR_THEMES[theme];

    const systemPrompt = SYSTEM_PPT.replace('{LOGO}', this.logo())
      .replace('{AUTHOR}', this.author())
      .replace('{CONTACT}', this.contact())
      .replace('{PRIMARY}', colors.primary)
      .replace('{SECONDARY}', colors.secondary)
      .replace('{ACCENT}', colors.accent)
      .replace('{TOPIC}', this.prompt());

    const prompt = this.llm.buildPrompt(systemPrompt, 'Generate the presentation now.');

    try {
      let full = '';
      await this.llm.generate(prompt, (_, done, fullText) => {
        full = fullText;
        const cleaned = fullText
          .replace(/```html\s*/gi, '')
          .replace(/```\s*$/g, '')
          .trim();
        this.generatedHtml.set(cleaned);
      });

      const cleaned = full
        .replace(/```html\s*/gi, '')
        .replace(/```\s*$/g, '')
        .trim();
      this.generatedHtml.set(cleaned);
      const count = (cleaned.match(/<section\s[^>]*class="slide"[^>]*>/gi) || []).length;
      this.slideCount.set(count);
      this.currentSlide.set(1);
      this.toast.show(`✅ Presentation generated! ${count} slides`);
    } catch (e: any) {
      const msg = e.message?.includes('INVALID_ARGUMENT')
        ? '⚠️ Presentation too long — try a simpler topic.'
        : '❌ ' + e.message;
      this.toast.show(msg);
    }

    this.generating.set(false);
  }

  getPreviewHtml(): SafeHtml {
    if (!this.generatedHtml()) return '';
    return this.safeHtml();
  }

  prevSlide() {
    this.currentSlide.update((c) => Math.max(1, c - 1));
    this.postSlideCommand();
  }

  nextSlide() {
    this.currentSlide.update((c) => Math.min(this.slideCount(), c + 1));
    this.postSlideCommand();
  }

  private postSlideCommand() {
    const iframe = this.previewFrame()?.nativeElement;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ command: 'goToSlide', slide: this.currentSlide() }, '*');
  }

  downloadHtml() {
    if (!this.generatedHtml()) return;
    const blob = new Blob([this.generatedHtml()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presentation.html';
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('💾 Presentation downloaded!');
  }

  setColorTheme(theme: ColorTheme) {
    this.colorTheme.set(theme);
    if (theme !== 'professional') {
      this.customPrimary.set(COLOR_THEMES[theme].primary);
    }
  }

  startResize(e: MouseEvent) {
    this.isResizing = true;
    e.preventDefault();
    document.addEventListener('mousemove', this.doResize);
    document.addEventListener('mouseup', this.stopResize);
  }

  private doResize = (e: MouseEvent) => {
    if (!this.isResizing) return;
    const el = this.previewFrame()?.nativeElement.parentElement;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const w = parent.clientWidth - e.clientX;
    if (w >= 350 && w <= parent.clientWidth - 280) {
      el.style.width = w + 'px';
    }
  };

  private stopResize = () => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.doResize);
    document.removeEventListener('mouseup', this.stopResize);
  };

  private removeResizeListeners() {
    document.removeEventListener('mousemove', this.doResize);
    document.removeEventListener('mouseup', this.stopResize);
  }

  onIframeKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') this.prevSlide();
    if (e.key === 'ArrowRight') this.nextSlide();
  }
}

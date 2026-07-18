import {
  Component,
  inject,
  signal,
  computed,
  viewChild,
  ElementRef,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { PRESENTATION_SYSTEM_PROMPT } from '../../core/services/presentation-prompt';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { TextProcessingService } from '../../core/services/text-processing.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

type ColorTheme = 'professional' | 'ocean' | 'forest' | 'sunset' | 'monochrome';

const COLOR_THEMES: Record<ColorTheme, { primary: string; secondary: string; accent: string }> = {
  professional: { primary: '#3b82f6', secondary: '#1e293b', accent: '#60a5fa' },
  ocean: { primary: '#06b6d4', secondary: '#0f172a', accent: '#22d3ee' },
  forest: { primary: '#10b981', secondary: '#1a2e1a', accent: '#34d399' },
  sunset: { primary: '#f97316', secondary: '#2d1b0e', accent: '#fb923c' },
  monochrome: { primary: '#94a3b8', secondary: '#0f111a', accent: '#cbd5e1' },
};

@Component({
  selector: 'app-presentation-tab',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './presentation-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
  styleUrl: './presentation-tab.component.css',
})
export class PresentationTabComponent implements OnInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  private readonly textProc = inject(TextProcessingService);

  readonly previewFrame = viewChild.required<ElementRef<HTMLIFrameElement>>('previewFrame');

  prompt = signal('Create a presentation about AI and machine learning trends in 2026');
  fileContent = signal<string | null>(null);
  fileName = signal<string | null>(null);
  generating = signal(false);
  slideCount = signal(0);
  currentSlide = signal(0);
  generatedHtml = signal<string>('');
  brandingOpen = signal(false);

  slideCountOption = signal<'auto' | number>('auto');
  slideCountCustom = signal(10);
  style = signal<'modern' | 'minimal' | 'bold' | 'corporate'>('modern');

  logo = signal('✦ INES');
  logoImage = signal<string | null>(null);
  logoImageName = signal<string | null>(null);
  author = signal('Marco Martorana');
  contact = signal('hello@ines.ai · ines.ai');
  colorTheme = signal<ColorTheme>('professional');
  customPrimary = signal('#3b82f6');

  readonly safeHtml = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.generatedHtml()));

  private isResizing = false;

  readonly themeColors = COLOR_THEMES;
  readonly themes: ColorTheme[] = ['professional', 'ocean', 'forest', 'sunset', 'monochrome'];
  readonly styleOptions: Array<{ value: string; label: string; icon: string }> = [
    { value: 'modern', label: 'Modern', icon: 'auto_awesome' },
    { value: 'minimal', label: 'Minimal', icon: 'minimize' },
    { value: 'bold', label: 'Bold', icon: 'bolt' },
    { value: 'corporate', label: 'Corporate', icon: 'business' },
  ];

  ngOnInit() {
    window.addEventListener('message', this.handleMessage);
  }

  ngOnDestroy() {
    this.removeResizeListeners();
    window.removeEventListener('message', this.handleMessage);
  }

  private handleMessage = (event: MessageEvent) => {
    // Basic verification: check if it came from our iframe
    const iframe = this.previewFrame()?.nativeElement;
    if (!iframe || event.source !== iframe.contentWindow) return;

    if (event.data?.type === 'slideChanged') {
      const slide = event.data.slide;
      if (typeof slide === 'number') {
        this.currentSlide.set(slide);
      }
    }
  };

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['md', 'txt', 'pdf'];
    if (!ext || !allowed.includes(ext)) {
      this.toast.show('Please upload a .md, .txt, or .pdf file');
      return;
    }

    try {
      let text = '';
      if (ext === 'pdf') {
        text = await this.textProc.extractTextFromPdf(file);
      } else {
        text = await file.text();
      }

      this.fileContent.set(text);
      this.fileName.set(file.name);
      this.toast.show(`Loaded: ${file.name} (${(text.length / 1024).toFixed(1)} KB)`);

      if (!this.prompt().trim() || this.prompt().includes('AI and machine learning trends')) {
        this.prompt.set(`Generate a presentation based on the uploaded file: ${file.name}`);
      }
    } catch (err) {
      this.toast.error('Error reading file');
    }
  }

  clearFile() {
    this.fileContent.set(null);
    this.fileName.set(null);
    this.toast.show('File cleared');
  }

  onLogoImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.logoImage.set(reader.result as string);
      this.logoImageName.set(file.name);
    };
    reader.readAsDataURL(file);
  }

  clearLogoImage() {
    this.logoImage.set(null);
    this.logoImageName.set(null);
  }

  async generate() {
    if (this.generating()) return;
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }

    this.generating.set(true);
    this.generatedHtml.set('');
    this.slideCount.set(0);
    this.currentSlide.set(0);
    this.toast.show('Generating presentation...');

    const theme = this.colorTheme();
    const colors =
      theme === 'professional'
        ? {
            primary: this.customPrimary(),
            secondary: COLOR_THEMES[theme].secondary,
            accent: COLOR_THEMES[theme].accent,
          }
        : COLOR_THEMES[theme];

    const requestedSlides =
      this.slideCountOption() === 'auto'
        ? 'auto (8–14, depending on content depth)'
        : String(this.slideCountCustom());

    const slideCountGuide =
      this.slideCountOption() === 'auto'
        ? 'Choose 8–14 slides based on content depth — include section dividers for pacing.'
        : `Create EXACTLY ${this.slideCountCustom()} slides. Each slide must have meaningful, non-redundant content.`;

    const styleGuide =
      this.style() === 'minimal'
        ? 'STYLE: MINIMAL — Use extreme whitespace. Large hero typography. Max 20 words per slide. Very clean, airy layouts with generous padding. Subtle accent touches only.'
        : this.style() === 'bold'
          ? 'STYLE: BOLD — Use strong saturated colors, oversized typography, dramatic scale contrasts, high-energy layouts. Make a statement on every slide. Dark gradients, neon accent glows.'
          : this.style() === 'corporate'
            ? 'STYLE: CORPORATE — Structured grid layouts, data-driven, professional tone. Use stats cards heavily. Clean sans-serif, muted accents, lots of white space. Boardroom-ready polish.'
            : 'STYLE: MODERN — Glassmorphism cards, smooth gradients, rounded corners, soft shadows. Balanced text-to-visual ratio. Refined and contemporary.';

    const systemPrompt = PRESENTATION_SYSTEM_PROMPT.replace(/\{LOGO\}/g, this.logo())
      .replace(/\{AUTHOR\}/g, this.author())
      .replace(/\{CONTACT\}/g, this.contact())
      .replace(
        /\{LOGO_IMAGE\}/g,
        this.logoImage()
          ? `Logo image (data URL, embed via <img src="..."> where appropriate): ${this.logoImage()}`
          : '',
      )
      .replace(/\{PRIMARY\}/g, colors.primary)
      .replace(/\{SECONDARY\}/g, colors.secondary)
      .replace(/\{ACCENT\}/g, colors.accent)
      .replace(/\{TOPIC\}/g, this.prompt())
      .replace(/\{SLIDE_COUNT\}/g, requestedSlides)
      .replace(/\{STYLE\}/g, this.style())
      .replace(
        /\{DATE\}/g,
        new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      )
      .replace(/\{SLIDE_COUNT_GUIDE\}/g, slideCountGuide)
      .replace(/\{STYLE_GUIDE\}/g, styleGuide)
      .replace(
        /\{MARKDOWN_CONTEXT\}/g,
        this.fileContent()
          ? `Use the following file content as the primary source for the presentation:\n\n${this.fileContent()}`
          : '',
      );

    const prompt = this.llm.buildPrompt(systemPrompt, 'Generate the presentation now.');

    try {
      let full = '';
      await this.llm.generate(prompt, (_, done, fullText) => {
        full = fullText;
        const cleaned = this.sanitizeLightBackgrounds(
          this.sanitizeDarkColors(
            fullText
              .replace(/```html\s*/gi, '')
              .replace(/```\s*$/g, '')
              .trim(),
          ),
        );
        this.generatedHtml.set(this.injectNavigationScript(cleaned));

        const count = (cleaned.match(/<section\s[^>]*class="slide"[^>]*>/gi) || []).length;
        this.slideCount.set(count);
      });

      const cleaned = this.sanitizeLightBackgrounds(
        this.sanitizeDarkColors(
          full
            .replace(/```html\s*/gi, '')
            .replace(/```\s*$/g, '')
            .trim(),
        ),
      );
      this.generatedHtml.set(this.injectNavigationScript(cleaned));
      const count = (cleaned.match(/<section\s[^>]*class="slide"[^>]*>/gi) || []).length;
      this.slideCount.set(count);
      this.currentSlide.set(1);
      this.toast.success(`Presentation generated! ${count} slides`);
    } catch (e: any) {
      const msg = e.message?.includes('INVALID_ARGUMENT')
        ? '⚠️ Presentation too long — try a simpler topic or fewer slides.'
        : '❌ ' + e.message;
      this.toast.show(msg);
    }

    this.generating.set(false);
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

  private injectNavigationScript(html: string): string {
    const overrideCss = [
      '<style>',
      'html,body,section,.slide,.hero,.divider,.quote-slide{background-color:#000!important}',
      'body,p,li,h1,h2,h3,h4,h5,h6,blockquote,cite,td,th,label{color:#f0f2f8!important}',
      '.glass-card,.stat-card{background:rgba(18,22,35,0.85)!important}',
      this.logoImage()
        ? '.ppt-logo-overlay{position:absolute;bottom:20px;right:28px;max-width:160px;max-height:56px;padding:8px 14px;background:rgba(0,0,0,0.55);border-radius:12px;opacity:0.9;pointer-events:none;z-index:10;object-fit:contain}'
        : '',
      '</style>',
    ].join('');

    if (this.logoImage()) {
      html = html.replace(
        /(<div class="slide-nav">[\s\S]*?<\/div>\s*)(<\/section>)/gi,
        `$1<img src="${this.logoImage()}" class="ppt-logo-overlay" alt="logo">$2`,
      );
    }

    const script =
      '<script>' +
      'try{(function(){' +
      'document.body.style.setProperty("background","#000","important");' +
      'var s=document.querySelectorAll(".slide");' +
      'var c=1;' +
      's.forEach(function(e){e.style.setProperty("background-color","#000","important")});' +
      'function g(n){' +
      'if(n<1||n>s.length)return;' +
      'c=n;' +
      'for(var i=0;i<s.length;i++)s[i].style.display=i+1===n?"":"none";' +
      'document.querySelectorAll("[data-page=\\"current\\"]").forEach(function(e){e.textContent=String(n)});' +
      'document.querySelectorAll("[data-page=\\"total\\"]").forEach(function(e){e.textContent=String(s.length)});' +
      'window.parent.postMessage({type:"slideChanged",slide:n},"*");' +
      '}' +
      'document.addEventListener("click",function(e){' +
      'var b=e.target.closest("[data-nav]");' +
      'if(!b)return;' +
      'if(b.getAttribute("data-nav")==="prev")g(c-1);' +
      'if(b.getAttribute("data-nav")==="next")g(c+1);' +
      '});' +
      'document.addEventListener("keydown",function(e){' +
      'if(e.key==="ArrowLeft"){e.preventDefault();g(c-1);}' +
      'if(e.key==="ArrowRight"){e.preventDefault();g(c+1);}' +
      '});' +
      'window.addEventListener("message",function(e){' +
      'if(e.data&&e.data.command==="goToSlide"&&typeof e.data.slide==="number")g(e.data.slide);' +
      '});' +
      'g(1);' +
      '})();}catch(e){console.error(e)}' +
      '</script>';

    const bodyIdx = html.lastIndexOf('</body>');
    if (bodyIdx !== -1) {
      return html.slice(0, bodyIdx) + script + overrideCss + html.slice(bodyIdx);
    }
    return html + overrideCss + script;
  }

  private sanitizeLightBackgrounds(html: string): string {
    return html
      .replace(
        /(?<![a-z-])background(-color)?\s*:\s*(?:#f{3,6}|#F{3,6}|white|#fff\b)\s*[;!}]/gi,
        'background$1: #000000;',
      )
      .replace(
        /(?<![a-z-])background\s*:\s*rgb\(\s*2[4-5]\d\s*,\s*2[4-5]\d\s*,\s*2[4-5]\d\s*\)/gi,
        'background: #000000',
      );
  }

  private sanitizeDarkColors(html: string): string {
    const darkColors = [
      '#000',
      '#000000',
      '#111',
      '#111111',
      '#222',
      '#222222',
      '#333',
      '#333333',
      '#444',
      '#444444',
      '#555',
      '#555555',
      '#666',
      '#666666',
      '#777',
      '#777777',
      '#888',
      '#888888',
      '#999',
      '#999999',
      'black',
    ];
    let result = html;
    for (const dc of darkColors) {
      const regex = new RegExp(`(?<![a-z-])color\\s*:\\s*${dc}\\b`, 'gi');
      result = result.replace(regex, 'color: #f0f2f8');
    }
    result = result.replace(
      /(?<![a-z-])color\s*:\s*rgb\(\s*0+\s*,\s*0+\s*,\s*0+\s*\)/gi,
      'color: #f0f2f8',
    );
    result = result.replace(
      /(?<![a-z-])color\s*:\s*rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/gi,
      (_match, r: string, g: string, b: string) => {
        const ri = parseInt(r, 10);
        const gi = parseInt(g, 10);
        const bi = parseInt(b, 10);
        return ri <= 160 && gi <= 160 && bi <= 160 ? 'color: #f0f2f8' : _match;
      },
    );
    return result;
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
    this.toast.success('Presentation downloaded!');
  }

  private pptxPromise: Promise<any> | null = null;

  private async getPptxGenJS(): Promise<any> {
    if (!this.pptxPromise) {
      this.pptxPromise = import('pptxgenjs').then((m) => m.default);
    }
    return this.pptxPromise;
  }

  async downloadPptx() {
    if (!this.generatedHtml()) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(this.generatedHtml(), 'text/html');
    const slides = Array.from(doc.querySelectorAll('section.slide'));

    if (slides.length === 0) {
      this.toast.show('No slides found in the presentation');
      return;
    }

    const PptxGenJS = await this.getPptxGenJS();
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = this.author();

    for (const slide of slides) {
      const heading = slide.querySelector('h1, h2, .slide-heading, .section-title, .title');
      const paragraphs = slide.querySelectorAll(
        'p:not(.author):not(.subtitle):not(.section-subtitle)',
      );
      const bulletItems = slide.querySelectorAll('.bullet-list li');
      const statCards = slide.querySelectorAll('.stat-card');
      const hasHero = slide.classList.contains('hero');
      const hasDivider = slide.classList.contains('divider');
      const hasQuote = slide.classList.contains('quote-slide');

      const headingText = heading?.textContent?.trim() || '';

      if (hasHero || hasDivider) {
        const titleSlide = pptx.addSlide();
        titleSlide.background = { fill: '#000000' };
        const subtitle = slide.querySelector('.subtitle, .section-subtitle');
        const authorEl = slide.querySelector('.author');

        titleSlide.addText(headingText || 'Title', {
          x: 0.5,
          y: 1.8,
          w: 9,
          h: 1.4,
          fontSize: 36,
          bold: true,
          color: 'FFFFFF',
          align: 'center',
        });

        if (subtitle?.textContent?.trim()) {
          titleSlide.addText(subtitle.textContent.trim(), {
            x: 1,
            y: 3.2,
            w: 8,
            h: 0.8,
            fontSize: 16,
            color: 'CCCCCC',
            align: 'center',
          });
        }

        if (authorEl?.textContent?.trim()) {
          titleSlide.addText(authorEl.textContent.trim(), {
            x: 1,
            y: 4.2,
            w: 8,
            h: 0.6,
            fontSize: 12,
            color: '999999',
            align: 'center',
          });
        }
      } else if (hasQuote) {
        const quoteSlide = pptx.addSlide();
        quoteSlide.background = { fill: '#000000' };
        const quoteEl = slide.querySelector('blockquote, .big-quote');
        const citeEl = slide.querySelector('cite, .quote-author');

        if (quoteEl?.textContent?.trim()) {
          quoteSlide.addText(quoteEl.textContent.trim(), {
            x: 1,
            y: 2,
            w: 8,
            h: 2,
            fontSize: 24,
            italic: true,
            color: 'FFFFFF',
            align: 'center',
          });
        }

        if (citeEl?.textContent?.trim()) {
          quoteSlide.addText(citeEl.textContent.trim(), {
            x: 1,
            y: 4.2,
            w: 8,
            h: 0.6,
            fontSize: 14,
            color: '999999',
            align: 'center',
          });
        }
      } else if (statCards.length > 0) {
        const statSlide = pptx.addSlide();
        statSlide.background = { fill: '#000000' };

        if (headingText) {
          statSlide.addText(headingText, {
            x: 0.5,
            y: 0.4,
            w: 9,
            h: 0.8,
            fontSize: 24,
            bold: true,
            color: 'FFFFFF',
          });
        }

        const statTexts: string[] = [];
        statCards.forEach((card) => {
          const num = card.querySelector('.stat-number')?.textContent?.trim();
          const label = card.querySelector('.stat-label')?.textContent?.trim();
          if (num && label) statTexts.push(`${num} — ${label}`);
          else if (num) statTexts.push(num);
        });

        if (statTexts.length > 0) {
          statSlide.addText(
            statTexts.map((s) => ({ text: s, options: { bullet: true, breakLine: true } })),
            {
              x: 1,
              y: 1.6,
              w: 8,
              h: 3.5,
              fontSize: 18,
              color: 'FFFFFF',
              bullet: true,
            },
          );
        }
      } else {
        const contentSlide = pptx.addSlide();
        contentSlide.background = { fill: '#000000' };

        if (headingText) {
          contentSlide.addText(headingText, {
            x: 0.5,
            y: 0.4,
            w: 9,
            h: 0.8,
            fontSize: 24,
            bold: true,
            color: 'FFFFFF',
          });
        }

        const contentTexts: { text: string; options: object }[] = [];

        if (bulletItems.length > 0) {
          bulletItems.forEach((li) => {
            const text = li.textContent?.trim();
            if (text)
              contentTexts.push({
                text,
                options: { bullet: true, breakLine: true, fontSize: 16, color: 'FFFFFF' },
              });
          });
        } else if (paragraphs.length > 0) {
          paragraphs.forEach((p) => {
            const text = p.textContent?.trim();
            if (text && text.length > 5)
              contentTexts.push({
                text,
                options: { bullet: true, breakLine: true, fontSize: 16, color: 'FFFFFF' },
              });
          });
        }

        const textItems = contentTexts.map((item) => ({
          text: item.text,
          options: { bullet: true, breakLine: true, fontSize: 16, color: 'FFFFFF' },
        }));

        if (textItems.length > 0) {
          contentSlide.addText(textItems as any, {
            x: 0.7,
            y: 1.5,
            w: 8.6,
            h: 4,
            valign: 'top',
          });
        }
      }
    }

    await pptx.writeFile({ fileName: 'presentation.pptx' });
    this.toast.success('PPTX downloaded!');
  }

  setColorTheme(theme: ColorTheme) {
    this.colorTheme.set(theme);
    if (theme !== 'professional') {
      this.customPrimary.set(COLOR_THEMES[theme].primary);
    }
  }

  setStyle(value: string) {
    if (value === 'modern' || value === 'minimal' || value === 'bold' || value === 'corporate') {
      this.style.set(value);
    }
  }

  incrementSlides() {
    this.slideCountCustom.set(Math.min(30, this.slideCountCustom() + 1));
  }

  decrementSlides() {
    this.slideCountCustom.set(Math.max(4, this.slideCountCustom() - 1));
  }

  regenerate() {
    if (!this.generatedHtml()) return;
    this.generate();
  }

  toggleFullscreen() {
    const iframe = this.previewFrame()?.nativeElement;
    if (!iframe) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      iframe.requestFullscreen();
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

  private readonly stopResize = () => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.doResize);
    document.removeEventListener('mouseup', this.stopResize);
  };

  private removeResizeListeners() {
    document.removeEventListener('mousemove', this.doResize);
    document.removeEventListener('mouseup', this.stopResize);
  }
}

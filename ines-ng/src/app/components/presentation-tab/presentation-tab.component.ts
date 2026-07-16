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
import * as pdfjsLib from 'pdfjs-dist';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

type ColorTheme = 'professional' | 'ocean' | 'forest' | 'sunset' | 'monochrome';

const COLOR_THEMES: Record<ColorTheme, { primary: string; secondary: string; accent: string }> = {
  professional: { primary: '#3b82f6', secondary: '#1e293b', accent: '#60a5fa' },
  ocean: { primary: '#06b6d4', secondary: '#0f172a', accent: '#22d3ee' },
  forest: { primary: '#10b981', secondary: '#1a2e1a', accent: '#34d399' },
  sunset: { primary: '#f97316', secondary: '#2d1b0e', accent: '#fb923c' },
  monochrome: { primary: '#94a3b8', secondary: '#0f111a', accent: '#cbd5e1' },
};

const SYSTEM_PPT = `You are an expert presentation designer. Generate a complete, self-contained HTML slide deck that looks professional and modern.

═══════════════════════════════
CRITICAL OUTPUT FORMAT RULES
═══════════════════════════════
1. Output ONLY valid HTML — no markdown fences, no intro text, no closing remarks.
2. The HTML must start with <!DOCTYPE html> and contain <html><head><style>...</style></head><body>...
3. Every slide is <section class="slide" data-slide-number="N"> where N starts at 1.
4. ALL slides must have data-nav buttons AND page indicator (see SECTION below).
5. Absolutely no JavaScript — navigation is injected externally.

═══════════════════════════════
SLIDE STRUCTURE TEMPLATES
═══════════════════════════════

SLIDE 1 — TITLE SLIDE:
<section class="slide hero" data-slide-number="1">
  <div class="slide-content center">
    <div class="logo">{LOGO}</div>
    <h1 class="title">Main Title</h1>
    <p class="subtitle">Subtitle or tagline</p>
    <p class="author">{AUTHOR}</p>
  </div>
</section>

CONTENT SLIDE (use for slides 2 through N-1):
<section class="slide" data-slide-number="N">
  <div class="slide-content">
    <h2 class="slide-heading">Slide Title</h2>
    <div class="grid-2">
      <div><p>Point one or body text</p></div>
      <div>
        <ul class="bullet-list">
          <li><strong>Key point:</strong> description</li>
          <li><strong>Key point:</strong> description</li>
        </ul>
      </div>
    </div>
  </div>
</section>

SECTION DIVIDER SLIDE (optional, every 4-5 slides):
<section class="slide divider" data-slide-number="N">
  <div class="slide-content center">
    <h2 class="section-title">New Section Title</h2>
    <p class="section-subtitle">Brief section description</p>
  </div>
</section>

LAST SLIDE — THANK YOU / CONTACT:
<section class="slide hero" data-slide-number="N">
  <div class="slide-content center">
    <h2 class="title">Thank You</h2>
    <p class="subtitle">{CONTACT}</p>
    <p class="author">{AUTHOR}</p>
  </div>
</section>

═══════════════════════════════
MANDATORY ELEMENTS ON EVERY SLIDE
═══════════════════════════════
Every <section class="slide"> MUST include at the BOTTOM:
  <div class="slide-nav">
    <button class="nav-btn prev-btn" data-nav="prev">⬅ Previous</button>
    <span class="page-indicator"><span data-page="current">N</span> / <span data-page="total">TOTAL</span></span>
    <button class="nav-btn next-btn" data-nav="next">Next ➡</button>
  </div>

═══════════════════════════════
DESIGN SYSTEM
═══════════════════════════════

COLORS — embed these CSS variables in :root:
  --color-primary: {PRIMARY};
  --color-secondary: {SECONDARY};
  --color-accent: {ACCENT};
  --color-bg: #0a0b14;
  --color-surface: rgba(18, 22, 35, 0.85);
  --color-text: #f0f2f8;
  --color-text-dim: #8b92a8;
  --color-border: rgba(255, 255, 255, 0.08);

GLOBAL RESET (MUST include these in <style>):
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

TYPOGRAPHY:
  --font-heading: 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-body: 'Inter', 'Segoe UI', system-ui, sans-serif;
  h1, h2, h3, h4 { font-family: var(--font-heading); color: var(--color-text); }
  p, li, span { color: var(--color-text); }
  h1 { font-size: clamp(2.4rem, 5vw, 4rem); font-weight: 800; line-height: 1.15; }
  h2 { font-size: clamp(1.7rem, 4vw, 2.4rem); font-weight: 700; line-height: 1.2; }
  h3 { font-size: clamp(1.2rem, 3vw, 1.5rem); font-weight: 600; }
  p, li { font-size: clamp(1rem, 2vw, 1.15rem); line-height: 1.7; color: var(--color-text); }

LAYOUT:
  .slide { 
    display: flex; flex-direction: column; justify-content: center;
    min-height: 100vh; padding: 60px 80px; position: relative;
    background: var(--color-bg);
    color: var(--color-text);
    overflow: hidden;
  }
  .slide-content { max-width: 1100px; margin: 0 auto; width: 100%; }
  .center { text-align: center; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }

GLASS EFFECTS (apply to cards, panels):
  background: var(--color-surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 24px 28px;
  color: var(--color-text);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);

DECORATIVE ELEMENTS — use pseudo-elements for visual interest:
  .hero::before { content:''; position:absolute; width:600px; height:600px; 
    background:radial-gradient(circle, var(--color-primary) 0%, transparent 60%); 
    opacity:0.12; top:-200px; right:-200px; border-radius:50%; pointer-events:none; }
  .hero::after { content:''; position:absolute; width:400px; height:400px; 
    background:radial-gradient(circle, var(--color-accent) 0%, transparent 60%); 
    opacity:0.08; bottom:-150px; left:-150px; border-radius:50%; pointer-events:none; }

NAVIGATION BUTTONS:
  .slide-nav { display:flex; justify-content:space-between; align-items:center; 
    padding-top:24px; margin-top:auto; }
  .nav-btn { background:var(--color-surface); backdrop-filter:blur(12px); 
    border:1px solid var(--color-border); border-radius:12px; padding:10px 20px;
    color:var(--color-text); font-family:var(--font-body); font-size:0.9rem;
    cursor:pointer; transition:all 0.25s; }
  .nav-btn:hover { background:var(--color-primary); border-color:var(--color-primary); 
    transform:translateY(-2px); box-shadow:0 4px 16px rgba(59,130,246,0.3); }
  .page-indicator { color:var(--color-text-dim); font-size:0.85rem; 
    font-family:monospace; }

═══════════════════════════════
CONTENT QUALITY RULES
═══════════════════════════════
- Maximum 5-7 bullet points per slide — less is more
- Each bullet should be 10-15 words max — concise key phrases
- Use visual hierarchy: title → subtitle → key points → supporting detail
- Alternate between text-heavy and visual slides
- Section dividers every 4-5 slides to break up pacing
- Include at least one data/stats slide with a emphasized numbers or a simple visual
- Title slide: 30% height decorative, 70% content
- Last slide: include all contact info and a clear call-to-action

CRITICAL — COLOR & VISIBILITY:
- ALL text MUST use light colors (var(--color-text) = #f0f2f8) on dark background
- NEVER use black, #000, or dark gray text — the background is #0a0b14 (almost black)
- Every element that renders text MUST have: color: var(--color-text);
- Do NOT set color: inherit on elements that don't have a parent with var(--color-text)
- Cards/pills MUST have: background: var(--color-surface); color: var(--color-text);
- The body and every slide MUST have: background: var(--color-bg); color: var(--color-text);
- NEVER use 'color: initial' or rely on browser default text color

ACCESSIBILITY:
- Ensure WCAG AA contrast (4.5:1 for normal text, 3:1 for large text)
- Use semantic HTML (h1-h4, ul, p, section)
- Add aria-label to navigation buttons

═══════════════════════════════
PRESENTATION: {SLIDE_COUNT} slides, style: {STYLE}
═══════════════════════════════

Branding:
- Logo: {LOGO}
- Author: {AUTHOR}
- Contact: {CONTACT}
- Primary: {PRIMARY}
- Secondary: {SECONDARY}
- Accent: {ACCENT}

Topic: {TOPIC}

{SLIDE_COUNT_GUIDE}

{MARKDOWN_CONTEXT}`;

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
  llm = inject(LlmService);
  toast = inject(ToastService);

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
      this.toast.show('⚠️ Please upload a .md, .txt, or .pdf file');
      return;
    }

    try {
      let text = '';
      if (ext === 'pdf') {
        text = await this.extractPdfText(file);
      } else {
        text = await file.text();
      }

      this.fileContent.set(text);
      this.fileName.set(file.name);
      this.toast.show(`📄 Loaded: ${file.name} (${(text.length / 1024).toFixed(1)} KB)`);

      if (!this.prompt().trim() || this.prompt().includes('AI and machine learning trends')) {
        this.prompt.set(`Generate a presentation based on the uploaded file: ${file.name}`);
      }
    } catch (err) {
      this.toast.show('❌ Error reading file');
    }
  }

  private async extractPdfText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: false,
    }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }
    return fullText;
  }

  clearFile() {
    this.fileContent.set(null);
    this.fileName.set(null);
    this.toast.show('🗑️ File cleared');
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
        ? 'Use extreme whitespace, minimal text, large typography, very clean layout.'
        : this.style() === 'bold'
          ? 'Use strong colors, bold typography, high contrast, dramatic layouts. Make it energetic.'
          : this.style() === 'corporate'
            ? 'Use structured layouts, data/charts focus, professional tone, muted accents.'
            : 'Use modern glassmorphism, rounded cards, gradients, balanced text/visual ratio.';

    const systemPrompt = SYSTEM_PPT.replace(/\{LOGO\}/g, this.logo())
      .replace(/\{AUTHOR\}/g, this.author())
      .replace(/\{CONTACT\}/g, this.contact())
      .replace(/\{PRIMARY\}/g, colors.primary)
      .replace(/\{SECONDARY\}/g, colors.secondary)
      .replace(/\{ACCENT\}/g, colors.accent)
      .replace(/\{TOPIC\}/g, this.prompt())
      .replace(/\{SLIDE_COUNT\}/g, requestedSlides)
      .replace(/\{STYLE\}/g, this.style())
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
        const cleaned = fullText
          .replace(/```html\s*/gi, '')
          .replace(/```\s*$/g, '')
          .trim();
        this.generatedHtml.set(this.injectNavigationScript(cleaned));

        const count = (cleaned.match(/<section\s[^>]*class="slide"[^>]*>/gi) || []).length;
        this.slideCount.set(count);
      });

      const cleaned = full
        .replace(/```html\s*/gi, '')
        .replace(/```\s*$/g, '')
        .trim();
      this.generatedHtml.set(this.injectNavigationScript(cleaned));
      const count = (cleaned.match(/<section\s[^>]*class="slide"[^>]*>/gi) || []).length;
      this.slideCount.set(count);
      this.currentSlide.set(1);
      this.toast.show(`✅ Presentation generated! ${count} slides`);
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
    const script =
      '<script>' +
      'try{(function(){' +
      'var s=document.querySelectorAll(".slide");' +
      'var c=1;' +
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
    const idx = html.lastIndexOf('</body>');
    if (idx !== -1) {
      return html.slice(0, idx) + script + html.slice(idx);
    }
    return html + script;
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

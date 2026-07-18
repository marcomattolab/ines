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
import PptxGenJS from 'pptxgenjs';
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

const SYSTEM_PPT = `You are an expert presentation designer. Generate a complete HTML slide deck — modern, visually stunning, and highly readable.

═══════════════════════════════
CRITICAL OUTPUT RULES
═══════════════════════════════
1. Output ONLY valid HTML — no markdown fences, no intro text, no closing remarks.
2. Start with <!DOCTYPE html> → <html><head><style>...</style></head><body>...
3. Every slide is <section class="slide" data-slide-number="N"> (N starts at 1).
4. ALL slides MUST include nav buttons and page indicator at the bottom.
5. NO JavaScript — navigation is injected externally.

═══════════════════════════════
SLIDE TEMPLATES (mix these for variety)
═══════════════════════════════

TITLE SLIDE (slide 1):
<section class="slide hero" data-slide-number="1">
  <div class="slide-content center">
    <div class="logo">{LOGO}</div>
    <h1 class="title">Main Title</h1>
    <p class="subtitle">Subtitle or tagline</p>
    <p class="author">{AUTHOR}</p>
  </div>
</section>

STANDARD CONTENT (most common):
<section class="slide" data-slide-number="N">
  <div class="slide-content">
    <h2 class="slide-heading">Slide Title</h2>
    <div class="grid-2">
      <div>
        <p>Body text or explanation</p>
        <div class="stat-card"><span class="stat-number">75%</span><span class="stat-label">Key Metric</span></div>
      </div>
      <div>
        <ul class="bullet-list">
          <li><strong>Key point:</strong> concise description</li>
          <li><strong>Key point:</strong> concise description</li>
        </ul>
      </div>
    </div>
  </div>
</section>

BULLET-FOCUS SLIDE (for dense info):
<section class="slide" data-slide-number="N">
  <div class="slide-content">
    <h2 class="slide-heading">Slide Title</h2>
    <div class="cards-row">
      <div class="glass-card"><h3>Point 1</h3><p>Explanation or detail text supporting this point.</p></div>
      <div class="glass-card"><h3>Point 2</h3><p>Explanation or detail text supporting this point.</p></div>
      <div class="glass-card"><h3>Point 3</h3><p>Explanation or detail text supporting this point.</p></div>
    </div>
  </div>
</section>

STATS / DATA SLIDE (use at least once):
<section class="slide" data-slide-number="N">
  <div class="slide-content">
    <h2 class="slide-heading">Key Insights</h2>
    <div class="stats-grid">
      <div class="stat-card large"><span class="stat-number">3.2x</span><span class="stat-label">Growth Rate</span></div>
      <div class="stat-card large"><span class="stat-number">$12B</span><span class="stat-label">Market Size</span></div>
      <div class="stat-card large"><span class="stat-number">94%</span><span class="stat-label">Adoption</span></div>
    </div>
  </div>
</section>

QUOTE / EMPHASIS SLIDE (for impact):
<section class="slide quote-slide" data-slide-number="N">
  <div class="slide-content center">
    <blockquote class="big-quote">"The memorable quote or key takeaway that deserves its own slide."</blockquote>
    <cite class="quote-author">— Source or Attribution</cite>
  </div>
</section>

SECTION DIVIDER (every 4-5 slides):
<section class="slide divider" data-slide-number="N">
  <div class="slide-content center">
    <h2 class="section-title">Section Name</h2>
    <p class="section-subtitle">Brief transition description</p>
  </div>
</section>

THANK YOU / CLOSING (last slide):
<section class="slide hero closing" data-slide-number="N">
  <div class="slide-content center">
    <h2 class="title">Thank You</h2>
    <p class="subtitle">{CONTACT}</p>
    <p class="author">{AUTHOR}</p>
    <p class="closing-cta">Let's build the future together</p>
  </div>
</section>

═══════════════════════════════
NAVIGATION (in EVERY slide, at the BOTTOM)
═══════════════════════════════
  <div class="slide-nav">
    <button class="nav-btn prev-btn" data-nav="prev" aria-label="Previous slide">&larr; Previous</button>
    <span class="page-indicator"><span data-page="current">N</span> / <span data-page="total">TOTAL</span></span>
    <button class="nav-btn next-btn" data-nav="next" aria-label="Next slide">Next &rarr;</button>
  </div>

═══════════════════════════════
DESIGN SYSTEM — MUST INCLUDE IN <style>
═══════════════════════════════

:root {
  --color-primary: {PRIMARY};
  --color-secondary: {SECONDARY};
  --color-accent: {ACCENT};
  --color-bg: #0a0b14;
  --color-surface: rgba(18, 22, 35, 0.85);
  --color-text: #f0f2f8;
  --color-text-dim: #8b92a8;
  --color-border: rgba(255, 255, 255, 0.08);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%; background: var(--color-bg); color: var(--color-text);
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased; overflow: hidden;
}

h1, h2, h3, h4 { font-weight: 700; color: var(--color-text); }
h1 { font-size: clamp(2.4rem, 5vw, 4rem); font-weight: 800; line-height: 1.15; }
h2 { font-size: clamp(1.7rem, 4vw, 2.4rem); line-height: 1.2; }
h3 { font-size: clamp(1.2rem, 3vw, 1.5rem); }
p, li { font-size: clamp(1rem, 2vw, 1.15rem); line-height: 1.7; color: var(--color-text); }

.slide {
  display: flex; flex-direction: column; justify-content: center;
  min-height: 100vh; padding: 60px 80px; position: relative;
  background: var(--color-bg); color: var(--color-text); overflow: hidden;
}
.slide-content { max-width: 1100px; margin: 0 auto; width: 100%; }
.center { text-align: center; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }

/* Glass cards */
.glass-card, .stat-card {
  background: var(--color-surface); backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px); border: 1px solid var(--color-border);
  border-radius: 20px; padding: 24px 28px; color: var(--color-text);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

/* Stat cards */
.stat-number { display: block; font-size: clamp(2.4rem, 5vw, 3.6rem); font-weight: 800;
  color: var(--color-primary); line-height: 1.1; margin-bottom: 8px; }
.stat-label { display: block; font-size: 0.95rem; color: var(--color-text-dim); text-transform: uppercase;
  letter-spacing: 0.06em; font-weight: 600; }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.cards-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }

/* Quote slide */
.quote-slide { background: var(--color-secondary); }
.big-quote { font-size: clamp(1.6rem, 3.5vw, 2.2rem); font-weight: 600; font-style: italic;
  line-height: 1.5; color: var(--color-text); max-width: 800px; margin: 0 auto 24px; }
.quote-author { font-size: 1.1rem; color: var(--color-text-dim); font-style: normal; }

/* Decorative blobs on hero slides */
.hero::before { content:''; position:absolute; width:600px; height:600px;
  background:radial-gradient(circle, var(--color-primary) 0%, transparent 60%);
  opacity:0.12; top:-200px; right:-200px; border-radius:50%; pointer-events:none; }
.hero::after { content:''; position:absolute; width:400px; height:400px;
  background:radial-gradient(circle, var(--color-accent) 0%, transparent 60%);
  opacity:0.08; bottom:-150px; left:-150px; border-radius:50%; pointer-events:none; }

/* Divider slide */
.divider { background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-bg) 100%); }
.section-title { font-size: clamp(2rem, 4.5vw, 3rem); font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.section-subtitle { font-size: 1.1rem; color: var(--color-text-dim); margin-top: 12px; }

/* Bullet list styling */
.bullet-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.bullet-list li { position: relative; padding-left: 24px; }
.bullet-list li::before { content:''; position:absolute; left:0; top:10px; width:8px; height:8px;
  border-radius:50%; background:var(--color-primary); }

/* Closing slide */
.closing-cta { font-size: 1rem; color: var(--color-text-dim); margin-top: 32px; opacity: 0.7; }

/* Navigation */
.slide-nav { display:flex; justify-content:space-between; align-items:center;
  padding-top:24px; margin-top:auto; }
.nav-btn { background:var(--color-surface); backdrop-filter:blur(12px);
  border:1px solid var(--color-border); border-radius:12px; padding:10px 24px;
  color:var(--color-text); font-family:inherit; font-size:0.9rem;
  cursor:pointer; transition:all 0.25s; }
.nav-btn:hover { background:var(--color-primary); border-color:var(--color-primary);
  transform:translateY(-2px); box-shadow:0 4px 16px rgba(59,130,246,0.3); }
.page-indicator { color:var(--color-text-dim); font-size:0.85rem; font-family:monospace; }

═══════════════════════════════
CONTENT RULES
═══════════════════════════════
- 3-6 bullet points per slide — every word must earn its place
- Each bullet: one clear idea, 8-15 words
- Every slide has ONE main message — don't mix unrelated topics
- Alternate content types: text → visuals → stats → quote → divider
- Use glass cards for grouped points; use stat cards for numbers/metrics
- Section dividers every 4-5 slides for pacing
- Every slide title should be a headline that tells the slide's point
- Use concrete numbers, dates, and names — never vague generalizations
- The closing slide must have a clear call-to-action

CRITICAL — COLOR:
- ALL text must use light colors on the dark background (#0a0b14)
- NEVER use black, #000, or dark text colors
- Every text element: color: var(--color-text);
- Cards: background: var(--color-surface); color: var(--color-text);

{STYLE_GUIDE}

═══════════════════════════════
PRESENTATION: {SLIDE_COUNT} slides, style: {STYLE}
═══════════════════════════════

Branding — Logo: {LOGO} | Author: {AUTHOR} | Contact: {CONTACT}
{LOGO_IMAGE}
Colors — Primary: {PRIMARY} | Secondary: {SECONDARY} | Accent: {ACCENT}
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
      this.toast.show('⚠️ Please upload a .md, .txt, or .pdf file');
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
      this.toast.show(`📄 Loaded: ${file.name} (${(text.length / 1024).toFixed(1)} KB)`);

      if (!this.prompt().trim() || this.prompt().includes('AI and machine learning trends')) {
        this.prompt.set(`Generate a presentation based on the uploaded file: ${file.name}`);
      }
    } catch (err) {
      this.toast.show('❌ Error reading file');
    }
  }

  clearFile() {
    this.fileContent.set(null);
    this.fileName.set(null);
    this.toast.show('🗑️ File cleared');
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
        ? 'STYLE: MINIMAL — Use extreme whitespace. Large hero typography. Max 20 words per slide. Very clean, airy layouts with generous padding. Subtle accent touches only.'
        : this.style() === 'bold'
          ? 'STYLE: BOLD — Use strong saturated colors, oversized typography, dramatic scale contrasts, high-energy layouts. Make a statement on every slide. Dark gradients, neon accent glows.'
          : this.style() === 'corporate'
            ? 'STYLE: CORPORATE — Structured grid layouts, data-driven, professional tone. Use stats cards heavily. Clean sans-serif, muted accents, lots of white space. Boardroom-ready polish.'
            : 'STYLE: MODERN — Glassmorphism cards, smooth gradients, rounded corners, soft shadows. Balanced text-to-visual ratio. Refined and contemporary.';

    const systemPrompt = SYSTEM_PPT.replace(/\{LOGO\}/g, this.logo())
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
        const cleaned = this.sanitizeDarkColors(
          fullText
            .replace(/```html\s*/gi, '')
            .replace(/```\s*$/g, '')
            .trim(),
        );
        this.generatedHtml.set(this.injectNavigationScript(cleaned));

        const count = (cleaned.match(/<section\s[^>]*class="slide"[^>]*>/gi) || []).length;
        this.slideCount.set(count);
      });

      const cleaned = this.sanitizeDarkColors(
        full
          .replace(/```html\s*/gi, '')
          .replace(/```\s*$/g, '')
          .trim(),
      );
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
    const colorFix =
      '<style>body,p,li,h1,h2,h3,h4,h5,h6,span,div,blockquote,cite,td,th,label{color:#f0f2f8}</style>';

    const headIdx = html.lastIndexOf('</head>');
    if (headIdx !== -1) {
      html = html.slice(0, headIdx) + colorFix + html.slice(headIdx);
    }

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
    this.toast.show('💾 Presentation downloaded!');
  }

  async downloadPptx() {
    if (!this.generatedHtml()) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(this.generatedHtml(), 'text/html');
    const slides = Array.from(doc.querySelectorAll('section.slide'));

    if (slides.length === 0) {
      this.toast.show('⚠️ No slides found in the presentation');
      return;
    }

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
        titleSlide.background = { fill: '#0a0b14' };
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
        quoteSlide.background = { fill: '#0a0b14' };
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
        statSlide.background = { fill: '#0a0b14' };

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
        contentSlide.background = { fill: '#0a0b14' };

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
    this.toast.show('📊 PPTX downloaded!');
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

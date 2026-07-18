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

const SYSTEM_PPT = `You are an elite presentation designer at a top-tier agency. Generate a complete, self-contained HTML slide deck — indistinguishable from a professionally designed Keynote or PowerPoint deck.

---
CRITICAL OUTPUT RULES
---
1. Output ONLY valid HTML — no markdown fences, no intro text, no closing remarks.
2. Start with <!DOCTYPE html> → <html><head><style>...</style></head><body>...
3. Every slide: <section class="slide" data-slide-number="N"> (N starts at 1).
4. ALL slides MUST include the nav block at the bottom.
5. NO JavaScript — navigation is injected externally.

---
SLIDE TEMPLATES — USE THESE EXACT PATTERNS
---

━ TITLE SLIDE (slide 1) ━
<section class="slide hero" data-slide-number="1">
  <div class="slide-content center">
    <div class="logo">{LOGO}</div>
    <h1 class="title">Presentation Title</h1>
    <p class="subtitle">Compelling subtitle that sets the tone</p>
    <div class="title-meta">
      <span class="meta-item">{AUTHOR}</span>
      <span class="meta-divider">·</span>
      <span class="meta-item">{DATE}</span>
    </div>
  </div>
</section>

━ TWO-COLUMN CONTENT (most versatile) ━
<section class="slide" data-slide-number="N">
  <div class="slide-content">
    <div class="slide-label">SECTION LABEL</div>
    <h2 class="slide-heading">Clear, Benefit-Driven Headline</h2>
    <div class="accent-bar"></div>
    <div class="grid-2">
      <div>
        <p class="body-lg">Lead paragraph that explains the key idea in 2-3 sentences.</p>
        <div class="insight-box">
          <span class="insight-icon">💡</span>
          <span class="insight-text">Key insight or takeaway</span>
        </div>
      </div>
      <div>
        <ul class="bullet-list">
          <li><strong>Bold point:</strong> supporting detail</li>
          <li><strong>Bold point:</strong> supporting detail</li>
          <li><strong>Bold point:</strong> supporting detail</li>
        </ul>
      </div>
    </div>
  </div>
</section>

━ THREE-CARD LAYOUT (features/pillars) ━
<section class="slide" data-slide-number="N">
  <div class="slide-content">
    <div class="slide-label">SECTION LABEL</div>
    <h2 class="slide-heading center">Three Pillars Headline</h2>
    <div class="accent-bar center-bar"></div>
    <div class="cards-row">
      <div class="feature-card">
        <div class="card-icon">01</div>
        <h3>Feature Name</h3>
        <p>Concise explanation of this feature or pillar in 1-2 lines.</p>
      </div>
      <div class="feature-card">
        <div class="card-icon">02</div>
        <h3>Feature Name</h3>
        <p>Concise explanation of this feature or pillar in 1-2 lines.</p>
      </div>
      <div class="feature-card">
        <div class="card-icon">03</div>
        <h3>Feature Name</h3>
        <p>Concise explanation of this feature or pillar in 1-2 lines.</p>
      </div>
    </div>
  </div>
</section>

━ STATS / KPI DASHBOARD ━
<section class="slide" data-slide-number="N">
  <div class="slide-content">
    <div class="slide-label">BY THE NUMBERS</div>
    <h2 class="slide-heading">Key Metrics at a Glance</h2>
    <div class="accent-bar"></div>
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-number">3.2x</span>
        <span class="stat-label">Revenue Growth</span>
        <span class="stat-desc">Year over year</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">$12B</span>
        <span class="stat-label">Market Size</span>
        <span class="stat-desc">Total addressable</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">94%</span>
        <span class="stat-label">Satisfaction</span>
        <span class="stat-desc">Client rating</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">50+</span>
        <span class="stat-label">Countries</span>
        <span class="stat-desc">Global presence</span>
      </div>
    </div>
  </div>
</section>

━ IMAGE + TEXT SPLIT ━
<section class="slide" data-slide-number="N">
  <div class="slide-content">
    <div class="split-layout">
      <div class="split-text">
        <div class="slide-label">SECTION LABEL</div>
        <h2 class="slide-heading">Visual Storytelling</h2>
        <div class="accent-bar"></div>
        <p class="body-lg">Compelling narrative text that pairs with the visual on the right. Keep it focused and impactful.</p>
        <ul class="bullet-list">
          <li><strong>Key point:</strong> supporting detail</li>
          <li><strong>Key point:</strong> supporting detail</li>
        </ul>
      </div>
      <div class="split-visual">
        <div class="img-placeholder">
          <span class="ph-icon">🖼</span>
          <span class="ph-label">Image / Diagram</span>
        </div>
      </div>
    </div>
  </div>
</section>

━ TIMELINE / PROCESS ━
<section class="slide" data-slide-number="N">
  <div class="slide-content">
    <div class="slide-label">ROADMAP</div>
    <h2 class="slide-heading center">Our Journey</h2>
    <div class="accent-bar center-bar"></div>
    <div class="timeline">
      <div class="timeline-item">
        <div class="tl-marker">Q1</div>
        <div class="tl-content">
          <h4>Phase One</h4>
          <p>Key milestone description</p>
        </div>
      </div>
      <div class="timeline-item">
        <div class="tl-marker">Q2</div>
        <div class="tl-content">
          <h4>Phase Two</h4>
          <p>Key milestone description</p>
        </div>
      </div>
      <div class="timeline-item">
        <div class="tl-marker">Q3</div>
        <div class="tl-content">
          <h4>Phase Three</h4>
          <p>Key milestone description</p>
        </div>
      </div>
      <div class="timeline-item">
        <div class="tl-marker">Q4</div>
        <div class="tl-content">
          <h4>Phase Four</h4>
          <p>Key milestone description</p>
        </div>
      </div>
    </div>
  </div>
</section>

━ QUOTE SLIDE ━
<section class="slide quote-slide" data-slide-number="N">
  <div class="slide-content center">
    <span class="quote-mark">"</span>
    <blockquote class="big-quote">The memorable insight or vision statement that inspires action.</blockquote>
    <cite class="quote-author">— Attribution, Title at Company</cite>
  </div>
</section>

━ SECTION DIVIDER (use every 4-5 slides) ━
<section class="slide divider" data-slide-number="N">
  <div class="slide-content center">
    <span class="divider-number">0N</span>
    <h2 class="section-title">Section Title</h2>
    <p class="section-subtitle">Brief transition description of what's coming next</p>
  </div>
</section>

━ CLOSING SLIDE (last) ━
<section class="slide hero closing" data-slide-number="N">
  <div class="slide-content center">
    <h2 class="title">Thank You</h2>
    <p class="subtitle">Let's continue the conversation</p>
    <div class="closing-info">
      <p class="closing-contact">{CONTACT}</p>
      <p class="closing-author">{AUTHOR}</p>
    </div>
  </div>
</section>

---
NAVIGATION (in EVERY slide, at BOTTOM)
---
  <div class="slide-nav">
    <button class="nav-btn prev-btn" data-nav="prev" aria-label="Previous">&larr; Prev</button>
    <span class="page-indicator"><span data-page="current">N</span> / <span data-page="total">TOTAL</span></span>
    <button class="nav-btn next-btn" data-nav="next" aria-label="Next">Next &rarr;</button>
  </div>

---
COMPLETE DESIGN SYSTEM (copy this CSS into <style>)
---

:root {
  --color-primary: {PRIMARY};
  --color-secondary: {SECONDARY};
  --color-accent: {ACCENT};
  --color-bg: #000000;
  --color-surface: rgba(22, 26, 38, 0.92);
  --color-text: #f0f2f8;
  --color-text-dim: #8b92a8;
  --color-border: rgba(255, 255, 255, 0.07);
  --color-muted: rgba(255, 255, 255, 0.04);
  --font-sans: 'Inter', 'Segoe UI', 'Helvetica Neue', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 24px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%; background: var(--color-bg); color: var(--color-text);
  font-family: var(--font-sans); font-size: 16px; line-height: 1.55;
  -webkit-font-smoothing: antialiased; overflow: hidden;
}

/* Typography */
h1, h2, h3, h4 { font-family: var(--font-sans); color: var(--color-text); letter-spacing: -0.02em; }
h1 { font-size: clamp(2.8rem, 5.5vw, 4.4rem); font-weight: 800; line-height: 1.1; }
h2 { font-size: clamp(2rem, 4vw, 2.8rem); font-weight: 700; line-height: 1.15; }
h3 { font-size: clamp(1.2rem, 2.5vw, 1.5rem); font-weight: 600; line-height: 1.3; }
h4 { font-size: 1.1rem; font-weight: 600; }
p, li { font-size: clamp(1rem, 1.8vw, 1.1rem); color: var(--color-text); }

/* Layout */
.slide {
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  min-height: 100vh; padding: 70px 90px; position: relative;
  background: var(--color-bg); overflow: hidden;
}
.slide-content { max-width: 1150px; width: 100%; }
.center { text-align: center; }

/* Slide label (small overline) */
.slide-label {
  font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.15em;
  color: var(--color-primary); margin-bottom: 12px;
}

/* Accent bar */
.accent-bar {
  width: 56px; height: 3px; background: var(--color-primary);
  border-radius: 2px; margin: 16px 0 28px 0;
}
.center-bar { margin-left: auto; margin-right: auto; }

/* Grids */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: start; }

/* Cards */
.glass-card, .stat-card, .feature-card {
  background: var(--color-surface); backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); padding: 28px 30px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.35);
}
.feature-card { text-align: center; padding: 36px 28px; }
.card-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; border-radius: 14px;
  background: rgba(255,255,255,0.06); color: var(--color-primary);
  font-family: var(--font-mono); font-size: 1.2rem; font-weight: 700; margin-bottom: 18px;
}
.cards-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.feature-card h3 { margin-bottom: 10px; }
.feature-card p { font-size: 0.95rem; color: var(--color-text-dim); }

/* Stats */
.stat-number { display: block; font-size: clamp(2.6rem, 5vw, 3.8rem); font-weight: 800;
  color: var(--color-primary); line-height: 1; margin-bottom: 6px; }
.stat-label { display: block; font-size: 0.9rem; font-weight: 700; color: var(--color-text);
  text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
.stat-desc { display: block; font-size: 0.78rem; color: var(--color-text-dim); }
.stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }

/* Insight box */
.insight-box {
  display: flex; align-items: center; gap: 12px; margin-top: 24px;
  padding: 16px 20px; background: rgba(255,255,255,0.03);
  border-left: 3px solid var(--color-primary); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.insight-icon { font-size: 1.3rem; }
.insight-text { font-size: 0.95rem; color: var(--color-text); }

/* Body large */
.body-lg { font-size: clamp(1.1rem, 2vw, 1.25rem); line-height: 1.65; color: var(--color-text); margin-bottom: 16px; }

/* Split layout (image + text) */
.split-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.img-placeholder {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  aspect-ratio: 4/3; background: var(--color-muted);
  border: 1px dashed var(--color-border); border-radius: var(--radius-lg);
}
.ph-icon { font-size: 2.5rem; opacity: 0.3; margin-bottom: 8px; }
.ph-label { font-size: 0.8rem; color: var(--color-text-dim); }

/* Timeline */
.timeline { display: flex; flex-direction: column; gap: 20px; margin-top: 32px; }
.timeline-item { display: flex; align-items: flex-start; gap: 20px; }
.tl-marker {
  flex-shrink: 0; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
  background: var(--color-primary); color: #000; border-radius: var(--radius-sm);
  font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700;
}
.tl-content { padding-top: 4px; }
.tl-content h4 { color: var(--color-text); margin-bottom: 2px; }
.tl-content p { font-size: 0.9rem; color: var(--color-text-dim); }

/* Quote */
.quote-slide { background: var(--color-bg) !important; position: relative; }
.quote-slide::before {
  content:''; position:absolute; inset:0;
  background: radial-gradient(ellipse at center, var(--color-primary) 0%, transparent 70%);
  opacity: 0.06; pointer-events:none;
}
.quote-mark {
  display: block; font-size: 8rem; font-weight: 900; line-height: 0.6;
  color: var(--color-primary); opacity: 0.2; margin-bottom: 8px;
}
.big-quote { font-size: clamp(1.8rem, 3.5vw, 2.4rem); font-weight: 500; font-style: italic;
  line-height: 1.45; max-width: 800px; margin: 0 auto 20px; color: var(--color-text); }
.quote-author { font-size: 1rem; color: var(--color-text-dim); }

/* Hero / Title */
.hero::before {
  content:''; position:absolute; width:700px; height:700px;
  background: radial-gradient(circle, var(--color-primary) 0%, transparent 60%);
  opacity: 0.1; top: -250px; right: -250px; border-radius: 50%; pointer-events: none;
}
.hero::after {
  content:''; position:absolute; width:500px; height:500px;
  background: radial-gradient(circle, var(--color-accent) 0%, transparent 60%);
  opacity: 0.07; bottom: -200px; left: -200px; border-radius: 50%; pointer-events: none;
}
.title { margin-bottom: 16px; }
.subtitle { font-size: clamp(1.1rem, 2vw, 1.4rem); color: var(--color-text-dim); margin-bottom: 24px; }
.title-meta { display: flex; align-items: center; justify-content: center; gap: 12px; }
.meta-item { font-size: 0.9rem; color: var(--color-text-dim); }
.meta-divider { color: var(--color-border); }

/* Logo */
.logo { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700;
  color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 32px; }

/* Divider */
.divider { position: relative; }
.divider::before {
  content:''; position:absolute; inset:0;
  background: linear-gradient(160deg, var(--color-secondary) 0%, var(--color-bg) 60%);
  opacity: 1;
}
.divider .slide-content { position: relative; z-index: 1; }
.divider-number {
  font-family: var(--font-mono); font-size: 5rem; font-weight: 900; opacity: 0.06;
  color: var(--color-text); line-height: 1; display: block; margin-bottom: -20px;
}
.section-title { font-size: clamp(2.2rem, 5vw, 3.2rem); font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.section-subtitle { font-size: 1.1rem; color: var(--color-text-dim); margin-top: 14px; }

/* Bullet list */
.bullet-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 18px; }
.bullet-list li { position: relative; padding-left: 26px; line-height: 1.55; }
.bullet-list li::before { content:''; position:absolute; left:0; top:9px;
  width:8px; height:8px; border-radius: 2px; background:var(--color-primary); }
.bullet-list li strong { color: var(--color-text); }

/* Closing */
.closing-info { margin-top: 40px; }
.closing-contact { font-size: 1rem; color: var(--color-text-dim); margin-bottom: 4px; }
.closing-author { font-size: 0.9rem; color: var(--color-text-dim); opacity: 0.7; }

/* Navigation */
.slide-nav { display:flex; justify-content:space-between; align-items:center;
  padding-top:28px; margin-top:auto; width: 100%; }
.nav-btn { background:var(--color-surface); backdrop-filter:blur(12px);
  border:1px solid var(--color-border); border-radius:10px; padding:10px 22px;
  color:var(--color-text-dim); font-family:var(--font-sans); font-size:0.82rem;
  cursor:pointer; transition:all 0.2s; }
.nav-btn:hover { background:var(--color-primary); color:#000; border-color:var(--color-primary);
  transform:translateY(-1px); }
.page-indicator { color:var(--color-text-dim); font-size:0.8rem; font-family:var(--font-mono); }

---
DESIGN RULES — FOLLOW STRICTLY
---
- Every slide has a SECTION LABEL (small overline in primary color) + HEADLINE + accent bar
- Title slide and closing slide are the EXCEPTION — no label
- 3-5 bullet points max per slide; each 6-14 words
- Use concrete data: real-looking numbers, percentages, dates, dollar amounts
- Vary slide types: never use the same layout twice in a row
- Section dividers every 4-5 slides
- Stats slides must use 4 stat cards in a 2x2 grid
- Include at least: 1 stats slide, 1 quote slide, 1 timeline slide, 1 three-card slide
- Every headline is benefit-driven: "Accelerate Growth 3x" not "Growth Metrics"
- Background is ALWAYS #000000 (pure black)
- ALL text is light: use var(--color-text) for body, var(--color-text-dim) for secondary
- Subtitle slides: maximum visual impact, minimum words
- Closing slide: thank you + contact + clear CTA

{STYLE_GUIDE}

---
PRESENTATION: {SLIDE_COUNT} slides | Style: {STYLE}
---

Brand — Logo: {LOGO} | Author: {AUTHOR} | Contact: {CONTACT}
{LOGO_IMAGE}
Colors — Primary: {PRIMARY} | Secondary: {SECONDARY} | Accent: {ACCENT}
Topic: {TOPIC}
Date: {DATE}

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

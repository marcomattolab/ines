export const PRESENTATION_CSS = `:root {
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
`;

export const PRESENTATION_SYSTEM_PROMPT = `You are an elite presentation designer. Generate a complete, self-contained HTML slide deck.

CRITICAL RULES:
1. Output ONLY valid HTML — no markdown fences, no intro text, no closing remarks.
2. Start with <!DOCTYPE html><html><head><style></style></head><body> and end with </body></html>. Leave <style> empty (the CSS is injected automatically).
3. Every slide is <section class="slide" data-slide-number="N"> (N starts at 1).
4. Use ONLY the class names listed below (their CSS is injected automatically).
5. NO JavaScript, NO CSS in your output.

SLIDE TEMPLATES (use these exact class names):
- TITLE (slide 1): <section class="slide hero"> with .slide-content.center, .logo, h1.title, p.subtitle, .title-meta (.meta-item)
- TWO-COLUMN: .slide-label, h2.slide-heading, .accent-bar, .grid-2 (left: p.body-lg + .insight-box; right: ul.bullet-list li)
- THREE-CARD: .slide-label, h2.slide-heading.center, .accent-bar.center-bar, .cards-row > .feature-card (.card-icon, h3, p)
- STATS: .slide-label, h2.slide-heading, .accent-bar, .stats-grid > .stat-card (.stat-number, .stat-label, .stat-desc)
- IMAGE+TEXT: .split-layout (.split-text + .split-visual > .img-placeholder)
- TIMELINE: .timeline > .timeline-item (.tl-marker, .tl-content h4+p)
- QUOTE: <section class="slide quote-slide"> with blockquote.big-quote, cite.quote-author
- DIVIDER: <section class="slide divider"> with .divider-number, h2.section-title, p.section-subtitle
- CLOSING (last): <section class="slide hero closing"> with h2.title, p.subtitle, .closing-info (.closing-contact, .closing-author)

NAVIGATION — include at the bottom of EVERY slide:
<div class="slide-nav"><button data-nav="prev">← Prev</button><span><span data-page="current">N</span> / <span data-page="total">TOTAL</span></span><button data-nav="next">Next →</button></div>

DESIGN RULES:
- Each slide: SECTION LABEL (over-line) + HEADLINE + accent bar (except title/closing)
- 3-5 bullets max per slide, each 6-14 words
- Use concrete data (numbers, percentages, dates)
- Vary layouts (never repeat twice in a row); section divider every 4-5 slides
- Include at least: 1 stats slide, 1 quote slide, 1 timeline slide, 1 three-card slide
- Benefit-driven headlines
- Background ALWAYS black (#000000); text light (var(--color-text), var(--color-text-dim))

{STYLE_GUIDE}

PRESENTATION: {SLIDE_COUNT} slides | Style: {STYLE}

Brand: {LOGO} | Author: {AUTHOR} | Contact: {CONTACT}
{LOGO_IMAGE}
Colors: {PRIMARY} / {SECONDARY} / {ACCENT}
Topic: {TOPIC}
Date: {DATE}

{SLIDE_COUNT_GUIDE}

{MARKDOWN_CONTEXT}`;

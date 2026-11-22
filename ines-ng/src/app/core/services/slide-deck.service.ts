import { Injectable, inject } from '@angular/core';
import { LlmService } from './llm.service';
import { JsonParserService } from './json-parser.service';
import { PRESENTATION_CSS } from './presentation-prompt';

export type SlideColorTheme = 'professional' | 'ocean' | 'forest' | 'sunset' | 'monochrome';
export type SlideStyle = 'modern' | 'minimal' | 'bold' | 'corporate';

export interface SlideColors {
  primary: string;
  secondary: string;
  accent: string;
}

export const SLIDE_COLOR_THEMES: Record<SlideColorTheme, SlideColors> = {
  professional: { primary: '#3b82f6', secondary: '#1e293b', accent: '#60a5fa' },
  ocean: { primary: '#06b6d4', secondary: '#0f172a', accent: '#22d3ee' },
  forest: { primary: '#10b981', secondary: '#1a2e1a', accent: '#34d399' },
  sunset: { primary: '#f97316', secondary: '#2d1b0e', accent: '#fb923c' },
  monochrome: { primary: '#94a3b8', secondary: '#0f111a', accent: '#cbd5e1' },
};

export interface Slide {
  type: string;
  heading?: string;
  title?: string;
  subtitle?: string;
  text?: string;
  kicker?: string;
  bullets?: string[];
  stats?: { number?: string; label?: string; desc?: string }[];
  cards?: { icon?: string; title?: string; text?: string }[];
  quote?: string;
  author?: string;
  number?: string;
  meta?: string[];
  items?: { marker?: string; title?: string; text?: string }[];
  contact?: string;
  value?: string;
  caption?: string;
  visual?: string;
  left?: { title?: string; points?: string[] };
  right?: { title?: string; points?: string[] };
}

export interface SlideDeckOptions {
  topic: string;
  context?: string;
  /** 0 = auto (10 slides). */
  slideCount?: number;
  style?: SlideStyle;
  colors: SlideColors;
  logo?: string;
  author?: string;
  contact?: string;
  logoImage?: string | null;
}

export interface SlideDeck {
  slides: Slide[];
  html: string;
}

const SYSTEM_JSON = `You are an elite presentation designer. Create a slide deck as a JSON array.
Output ONLY the JSON array — no markdown fences, no explanations.

Each slide object has a "type" field plus the content fields for that type:
{"type":"title","title":"...","subtitle":"...","kicker":"TAGLINE","meta":["Author","Date"]}
{"type":"agenda","heading":"Agenda","items":[{"title":"...","text":"..."}]}
{"type":"bullets","kicker":"OVERLINE","heading":"...","bullets":["...","..."]}
{"type":"numbered","kicker":"OVERLINE","heading":"...","items":[{"title":"...","text":"..."}]}
{"type":"stats","kicker":"OVERLINE","heading":"...","stats":[{"number":"42%","label":"...","desc":"..."}]}
{"type":"cards","kicker":"OVERLINE","heading":"...","cards":[{"icon":"1","title":"...","text":"..."}]}
{"type":"big-number","value":"92%","heading":"...","text":"..."}
{"type":"quote","quote":"...","author":"..."}
{"type":"comparison","kicker":"OVERLINE","heading":"...","left":{"title":"A","points":["..."]},"right":{"title":"B","points":["..."]}}
{"type":"two-col","kicker":"OVERLINE","heading":"...","text":"...","bullets":["...","..."]}
{"type":"image","kicker":"OVERLINE","heading":"...","visual":"Concept diagram","caption":"..."}
{"type":"timeline","kicker":"OVERLINE","heading":"...","items":[{"marker":"2024","title":"...","text":"..."}]}
{"type":"divider","number":"02","title":"Section title","subtitle":"..."}
{"type":"closing","title":"Thank you","subtitle":"...","author":"...","contact":"..."}

Rules:
- Slide 1 MUST be "title", slide 2 MUST be "agenda", the last slide MUST be "closing".
- Insert a "divider" before each major topic shift.
- Vary layouts (never repeat the same type twice in a row) and include at least one "stats", one "quote", and one "timeline", "comparison" or "big-number".
- Benefit-driven headlines. 3-5 bullets max per slide, 6-14 words each. Use concrete numbers and dates.
- Write in the same language as the topic.`;

const STYLE_GUIDES: Record<SlideStyle, string> = {
  modern:
    'Style: MODERN — glassmorphism cards, smooth gradients, rounded corners, refined and contemporary.',
  minimal:
    'Style: MINIMAL — extreme whitespace, hero typography, max 20 words per slide, clean and airy.',
  bold: 'Style: BOLD — strong saturated colors, oversized typography, dramatic scale, high energy.',
  corporate:
    'Style: CORPORATE — structured grids, data-driven, stats cards, boardroom-ready polish.',
};

@Injectable({ providedIn: 'root' })
export class SlideDeckService {
  private readonly llm = inject(LlmService);
  private readonly jsonParser = inject(JsonParserService);

  /** Generates slide content as JSON, then renders deterministic HTML locally. */
  async generate(options: SlideDeckOptions): Promise<SlideDeck> {
    const count = options.slideCount && options.slideCount > 0 ? options.slideCount : 10;
    const style = options.style ?? 'modern';

    const system = [
      SYSTEM_JSON,
      STYLE_GUIDES[style],
      `\nNumber of slides: EXACTLY ${count}.`,
      options.context?.trim()
        ? `\nSource material (use this as the primary content):\n${options.context.trim().slice(0, 6000)}`
        : '',
      `\nTopic: ${options.topic}`,
    ].join('\n');

    const inputTokens = LlmService.estimateTokens(system);
    const maxOutput = Math.max(
      1024,
      Math.min(this.llm.modelMaxTokens(), this.llm.contextWindow() - inputTokens - 512),
    );

    let raw = '';
    await this.llm.generate(
      system,
      'Generate the slide deck as JSON.',
      [],
      (_, __, full) => {
        raw = full;
      },
      undefined,
      maxOutput,
    );

    const slides = this.parseSlides(raw, count);
    const html = this.renderDeck(slides, options);
    return { slides, html };
  }

  private parseSlides(raw: string, fallbackCount: number): Slide[] {
    let data: unknown = this.jsonParser.parse(raw);
    if (data && !Array.isArray(data) && Array.isArray((data as { slides?: unknown }).slides)) {
      data = (data as { slides: unknown[] }).slides;
    }
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('The model did not return valid slides. Please try again.');
    }

    const slides: Slide[] = data
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => {
        const slide: Slide = { type: String(s['type'] ?? 'bullets') };
        const str = (k: string): string | undefined =>
          typeof s[k] === 'string' && (s[k] as string).trim() ? (s[k] as string).trim() : undefined;
        slide.heading = str('heading');
        slide.title = str('title');
        slide.subtitle = str('subtitle');
        slide.text = str('text');
        slide.kicker = str('kicker');
        slide.quote = str('quote');
        slide.author = str('author');
        slide.number = str('number');
        slide.contact = str('contact');
        slide.value = str('value');
        slide.caption = str('caption');
        slide.visual = str('visual');
        if (s['left'] && typeof s['left'] === 'object') {
          const l = s['left'] as Record<string, unknown>;
          slide.left = {
            title: typeof l['title'] === 'string' ? l['title'] : undefined,
            points: Array.isArray(l['points'])
              ? (l['points'] as unknown[]).map(String).filter(Boolean)
              : undefined,
          };
        }
        if (s['right'] && typeof s['right'] === 'object') {
          const r = s['right'] as Record<string, unknown>;
          slide.right = {
            title: typeof r['title'] === 'string' ? r['title'] : undefined,
            points: Array.isArray(r['points'])
              ? (r['points'] as unknown[]).map(String).filter(Boolean)
              : undefined,
          };
        }
        if (Array.isArray(s['bullets'])) {
          slide.bullets = (s['bullets'] as unknown[]).map(String).filter((b) => b.trim());
        }
        if (Array.isArray(s['meta'])) {
          slide.meta = (s['meta'] as unknown[]).map(String).filter(Boolean);
        }
        if (Array.isArray(s['stats'])) {
          slide.stats = (s['stats'] as Record<string, unknown>[]).map((st) => ({
            number: String(st?.['number'] ?? ''),
            label: String(st?.['label'] ?? ''),
            desc: String(st?.['desc'] ?? ''),
          }));
        }
        if (Array.isArray(s['cards'])) {
          slide.cards = (s['cards'] as Record<string, unknown>[]).map((c) => ({
            icon: String(c?.['icon'] ?? ''),
            title: String(c?.['title'] ?? ''),
            text: String(c?.['text'] ?? ''),
          }));
        }
        if (Array.isArray(s['items'])) {
          slide.items = (s['items'] as Record<string, unknown>[]).map((it) => ({
            marker: String(it?.['marker'] ?? ''),
            title: String(it?.['title'] ?? ''),
            text: String(it?.['text'] ?? ''),
          }));
        }
        return slide;
      })
      .filter((s) => this.hasContent(s));

    return slides.length > 0 ? slides : this.fallbackSlides(fallbackCount);
  }

  private hasContent(s: Slide): boolean {
    switch (s.type) {
      case 'title':
      case 'closing':
      case 'divider':
        return !!(s.title || s.heading);
      case 'quote':
        return !!s.quote;
      case 'stats':
        return !!(s.stats?.length || s.heading);
      case 'cards':
        return !!(s.cards?.length || s.heading);
      case 'timeline':
        return !!(s.items?.length || s.heading);
      case 'two-col':
        return !!(s.text || s.bullets?.length || s.heading);
      case 'agenda':
      case 'numbered':
        return !!(s.items?.length || s.heading);
      case 'big-number':
        return !!(s.value || s.heading);
      case 'comparison':
        return !!(
          s.left?.title ||
          s.left?.points?.length ||
          s.right?.title ||
          s.right?.points?.length ||
          s.heading
        );
      case 'image':
        return !!(s.visual || s.caption || s.heading);
      default:
        return !!(s.bullets?.length || s.heading || s.text);
    }
  }

  private fallbackSlides(count: number): Slide[] {
    const slides: Slide[] = [{ type: 'title', title: 'Presentation', subtitle: '' }];
    for (let i = 1; i < count - 1; i++) {
      slides.push({ type: 'bullets', heading: `Section ${i}`, bullets: ['Key point'] });
    }
    slides.push({ type: 'closing', title: 'Thank you', subtitle: '' });
    return slides;
  }

  /** Renders slide models into a complete, self-contained HTML document. */
  renderDeck(slides: Slide[], options: SlideDeckOptions): string {
    const body = slides.map((s, i) => this.renderSlide(s, i + 1, options)).join('\n');

    const css = PRESENTATION_CSS.replace(/\{PRIMARY\}/g, options.colors.primary)
      .replace(/\{SECONDARY\}/g, options.colors.secondary)
      .replace(/\{ACCENT\}/g, options.colors.accent);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;
  }

  private renderSlide(s: Slide, n: number, o: SlideDeckOptions): string {
    const esc = (v?: string) => this.esc(v ?? '');
    const num = `data-slide-number="${n}"`;
    const kicker = s.kicker ? `<div class="slide-label">${esc(s.kicker)}</div>` : '';

    switch (s.type) {
      case 'title': {
        const meta = (s.meta ?? []).length
          ? s
              .meta!.map((m) => `<span class="meta-item">${esc(m)}</span>`)
              .join('<span class="meta-divider">·</span>')
          : '';
        return `<section class="slide hero" ${num}>
  <div class="slide-content center">
    <div class="logo">${esc(o.logo || '')}</div>
    ${s.kicker ? `<div class="hero-kicker">${esc(s.kicker)}</div>` : ''}
    <h1 class="title">${esc(s.title || o.topic)}</h1>
    ${s.subtitle ? `<p class="subtitle">${esc(s.subtitle)}</p>` : ''}
    ${meta ? `<div class="title-meta">${meta}</div>` : ''}
  </div>
</section>`;
      }

      case 'bullets': {
        const lis = (s.bullets ?? []).map((b) => `<li>${esc(b)}</li>`).join('');
        return `<section class="slide" ${num}>
  <div class="slide-content">
    ${kicker}
    <h2 class="slide-heading">${esc(s.heading || '')}</h2>
    <div class="accent-bar"></div>
    <ul class="bullet-list">${lis}</ul>
  </div>
</section>`;
      }

      case 'stats': {
        const cards = (s.stats ?? [])
          .slice(0, 4)
          .map(
            (st) =>
              `<div class="stat-card"><span class="stat-number">${esc(st.number)}</span><span class="stat-label">${esc(st.label)}</span>${st.desc ? `<span class="stat-desc">${esc(st.desc)}</span>` : ''}</div>`,
          )
          .join('');
        return `<section class="slide" ${num}>
  <div class="slide-content">
    ${kicker}
    <h2 class="slide-heading">${esc(s.heading || '')}</h2>
    <div class="accent-bar"></div>
    <div class="stats-grid">${cards}</div>
  </div>
</section>`;
      }

      case 'cards': {
        const cards = (s.cards ?? [])
          .slice(0, 3)
          .map(
            (c) =>
              `<div class="feature-card"><div class="card-icon">${esc(c.icon || '•')}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`,
          )
          .join('');
        return `<section class="slide" ${num}>
  <div class="slide-content">
    ${kicker}
    <h2 class="slide-heading center">${esc(s.heading || '')}</h2>
    <div class="accent-bar center-bar"></div>
    <div class="cards-row">${cards}</div>
  </div>
</section>`;
      }

      case 'quote':
        return `<section class="slide quote-slide" ${num}>
  <div class="slide-content center">
    <span class="quote-mark">"</span>
    <blockquote class="big-quote">${esc(s.quote || '')}</blockquote>
    ${s.author ? `<cite class="quote-author">— ${esc(s.author)}</cite>` : ''}
  </div>
</section>`;

      case 'divider':
        return `<section class="slide divider" ${num}>
  <div class="slide-content center">
    <span class="divider-number">${esc(s.number || String(n).padStart(2, '0'))}</span>
    <h2 class="section-title">${esc(s.title || s.heading || '')}</h2>
    ${s.subtitle ? `<p class="section-subtitle">${esc(s.subtitle)}</p>` : ''}
  </div>
</section>`;

      case 'two-col': {
        const lis = (s.bullets ?? []).map((b) => `<li>${esc(b)}</li>`).join('');
        return `<section class="slide" ${num}>
  <div class="slide-content">
    ${kicker}
    <h2 class="slide-heading">${esc(s.heading || '')}</h2>
    <div class="accent-bar"></div>
    <div class="grid-2">
      <div>
        <p class="body-lg">${esc(s.text || '')}</p>
      </div>
      <ul class="bullet-list">${lis}</ul>
    </div>
  </div>
</section>`;
      }

      case 'timeline': {
        const items = (s.items ?? [])
          .map(
            (it) =>
              `<div class="timeline-item"><div class="tl-marker">${esc(it.marker)}</div><div class="tl-content"><h4>${esc(it.title)}</h4><p>${esc(it.text)}</p></div></div>`,
          )
          .join('');
        return `<section class="slide" ${num}>
  <div class="slide-content">
    ${kicker}
    <h2 class="slide-heading">${esc(s.heading || '')}</h2>
    <div class="accent-bar"></div>
    <div class="timeline">${items}</div>
  </div>
</section>`;
      }

      case 'agenda': {
        const items = (s.items ?? [])
          .map(
            (it, i) =>
              `<div class="agenda-item"><span class="agenda-num">${String(i + 1).padStart(2, '0')}</span><div class="agenda-content"><h3>${esc(it.title)}</h3>${it.text ? `<p>${esc(it.text)}</p>` : ''}</div></div>`,
          )
          .join('');
        return `<section class="slide" ${num}>
  <div class="slide-content">
    ${kicker}
    <h2 class="slide-heading">${esc(s.heading || 'Agenda')}</h2>
    <div class="accent-bar"></div>
    <div class="agenda-list">${items}</div>
  </div>
</section>`;
      }

      case 'numbered': {
        const items = (s.items ?? [])
          .map(
            (it, i) =>
              `<div class="numbered-item"><span class="numbered-num">${i + 1}</span><div class="numbered-content"><h4>${esc(it.title)}</h4>${it.text ? `<p>${esc(it.text)}</p>` : ''}</div></div>`,
          )
          .join('');
        return `<section class="slide" ${num}>
  <div class="slide-content">
    ${kicker}
    <h2 class="slide-heading">${esc(s.heading || '')}</h2>
    <div class="accent-bar"></div>
    <div class="numbered-list">${items}</div>
  </div>
</section>`;
      }

      case 'big-number':
        return `<section class="slide big-number-slide" ${num}>
  <div class="slide-content center">
    ${kicker}
    <span class="big-number-value">${esc(s.value || '')}</span>
    <h2 class="slide-heading">${esc(s.heading || '')}</h2>
    ${s.text ? `<p class="body-lg">${esc(s.text)}</p>` : ''}
  </div>
</section>`;

      case 'comparison': {
        const col = (side?: { title?: string; points?: string[] }) => {
          const title = side?.title ? `<h3 class="comparison-title">${esc(side.title)}</h3>` : '';
          const lis = (side?.points ?? []).map((p) => `<li>${esc(p)}</li>`).join('');
          return `<div class="comparison-col"><div class="comparison-inner">${title}<ul class="bullet-list">${lis}</ul></div></div>`;
        };
        return `<section class="slide" ${num}>
  <div class="slide-content">
    ${kicker}
    <h2 class="slide-heading">${esc(s.heading || '')}</h2>
    <div class="accent-bar"></div>
    <div class="comparison-grid">${col(s.left)}${col(s.right)}</div>
  </div>
</section>`;
      }

      case 'image':
        return `<section class="slide" ${num}>
  <div class="slide-content">
    ${kicker}
    <h2 class="slide-heading">${esc(s.heading || '')}</h2>
    <div class="accent-bar"></div>
    <div class="visual-frame">
      <div class="visual-inner"><span class="visual-icon">◈</span><span class="visual-label">${esc(s.visual || 'Visual')}</span></div>
    </div>
    ${s.caption ? `<p class="visual-caption">${esc(s.caption)}</p>` : ''}
  </div>
</section>`;

      case 'closing':
      default:
        return `<section class="slide hero closing" ${num}>
  <div class="slide-content center">
    <h2 class="title">${esc(s.title || 'Thank you')}</h2>
    ${s.subtitle ? `<p class="subtitle">${esc(s.subtitle)}</p>` : ''}
    <div class="closing-info">
      ${s.contact || o.contact ? `<div class="closing-contact">${esc(s.contact || o.contact)}</div>` : ''}
      ${s.author || o.author ? `<div class="closing-author">${esc(s.author || o.author)}</div>` : ''}
    </div>
  </div>
</section>`;
    }
  }

  private esc(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── PPTX export ──

  private pptxPromise: Promise<any> | null = null;

  private getPptxGenJS(): Promise<any> {
    if (!this.pptxPromise) {
      this.pptxPromise = import('pptxgenjs').then((m) => m.default);
    }
    return this.pptxPromise;
  }

  async downloadPptx(html: string, author: string): Promise<void> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const slides = Array.from(doc.querySelectorAll('section.slide'));
    if (slides.length === 0) {
      throw new Error('No slides found in the presentation');
    }

    const PptxGenJS = await this.getPptxGenJS();
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = author;

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
        const authorEl = slide.querySelector('.author, .closing-author');

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
            statTexts.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })),
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
        const texts: string[] = [];
        if (bulletItems.length > 0) {
          bulletItems.forEach((li) => {
            const t = li.textContent?.trim();
            if (t) texts.push(t);
          });
        } else {
          paragraphs.forEach((p) => {
            const t = p.textContent?.trim();
            if (t && t.length > 5) texts.push(t);
          });
        }
        if (texts.length > 0) {
          contentSlide.addText(
            texts.map((t) => ({
              text: t,
              options: { bullet: true, breakLine: true, fontSize: 16, color: 'FFFFFF' },
            })),
            { x: 0.7, y: 1.5, w: 8.6, h: 4, valign: 'top' },
          );
        }
      }
    }

    await pptx.writeFile({ fileName: 'presentation.pptx' });
  }
}

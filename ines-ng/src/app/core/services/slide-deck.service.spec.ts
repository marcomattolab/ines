import { describe, it, expect, vi } from 'vitest';
import { Injector } from '@angular/core';
import { SlideDeckService, SLIDE_COLOR_THEMES } from './slide-deck.service';
import { JsonParserService } from './json-parser.service';
import { LlmService } from './llm.service';

/** Realistic output the on-device model is asked to produce. */
const MOCK_JSON = `[
  {"type":"title","title":"AI & Machine Learning 2026","subtitle":"Tendenze, numeri e impatti","meta":["INES","2026"]},
  {"type":"bullets","heading":"Agenda","bullets":["Trend di mercato","Modelli on-device","Impatto sul lavoro","Conclusioni"]},
  {"type":"stats","heading":"Numeri chiave","stats":[{"number":"$1.3T","label":"mercato AI 2030","desc":"CAGR 36%"},{"number":"70%","label":"inferenza on-device","desc":"entro il 2027"}]},
  {"type":"quote","quote":"L'AI migliore è quella che rispetta la tua privacy.","author":"INES"},
  {"type":"timeline","heading":"Roadmap","items":[{"marker":"2024","title":"LLM locali","text":"Gemma nel browser"},{"marker":"2026","title":"Edge AI","text":"Inferenza GPU nel browser"}]},
  {"type":"cards","heading":"Aree chiave","cards":[{"icon":"1","title":"Privacy","text":"Zero cloud"},{"icon":"2","title":"Velocità","text":"Inferenza locale"},{"icon":"3","title":"Costo","text":"Nessun server"}]},
  {"type":"closing","title":"Grazie","subtitle":"Domande?","author":"Marco Martorana","contact":"hello@ines.ai"}
]`;

function createService() {
  const fakeLlm = {
    modelMaxTokens: () => 8192,
    contextWindow: () => 8192,
    generate: vi.fn(
      async (
        _s: string,
        _u: string,
        _h: unknown[],
        onToken: (p: string, d: boolean, f: string) => void,
      ) => {
        onToken(MOCK_JSON, true, MOCK_JSON);
        return MOCK_JSON;
      },
    ),
  };
  const injector = Injector.create({
    providers: [{ provide: LlmService, useValue: fakeLlm }, JsonParserService, SlideDeckService],
  });
  return { service: injector.get(SlideDeckService), fakeLlm };
}

describe('SlideDeckService', () => {
  it('generates a deck from model JSON and renders section.slide blocks', async () => {
    const { service } = createService();
    const deck = await service.generate({
      topic: 'AI trends',
      slideCount: 7,
      colors: SLIDE_COLOR_THEMES.professional,
    });

    expect(deck.slides.length).toBe(7);
    expect(deck.slides[0].type).toBe('title');
    expect(deck.slides[deck.slides.length - 1].type).toBe('closing');

    const sections = deck.html.match(/<section class="slide/g) || [];
    expect(sections.length).toBe(7);
    expect(deck.html).toContain('<!DOCTYPE html>');
    expect(deck.html).toContain('Machine Learning 2026');
    expect(deck.html).not.toContain('<script>');
  });

  it('rejects non-JSON output with a clear error', async () => {
    const { service, fakeLlm } = createService();
    fakeLlm.generate.mockImplementation(
      async (
        _s: string,
        _u: string,
        _h: unknown[],
        onToken: (p: string, d: boolean, f: string) => void,
      ) => {
        const text = 'scusa non ho capito, riprova';
        onToken(text, true, text);
        return text;
      },
    );

    await expect(
      service.generate({ topic: 'x', colors: SLIDE_COLOR_THEMES.ocean }),
    ).rejects.toThrow(/did not return valid slides/i);
  });

  it('renders a deterministic HTML file with the requested slide count', () => {
    const { service } = createService();
    const slides = Array.from({ length: 5 }, (_, i) => ({
      type: 'bullets',
      heading: `Slide ${i + 1}`,
      bullets: [`Punto ${i + 1}`],
    }));
    const html = service.renderDeck(slides, {
      topic: 'demo',
      colors: SLIDE_COLOR_THEMES.sunset,
    });
    expect((html.match(/<section class="slide/g) || []).length).toBe(5);
  });

  it('renders the extended slide layouts with their dedicated classes', () => {
    const { service } = createService();
    const html = service.renderDeck(
      [
        { type: 'title', title: 'T', kicker: 'Tag' },
        { type: 'agenda', heading: 'Agenda', items: [{ title: 'Intro', text: 'Details' }] },
        { type: 'numbered', heading: 'Steps', items: [{ title: 'One', text: 'First' }] },
        { type: 'big-number', value: '92%', heading: 'Adoption' },
        {
          type: 'comparison',
          heading: 'A vs B',
          left: { title: 'A', points: ['x'] },
          right: { title: 'B', points: ['y'] },
        },
        { type: 'image', heading: 'Diagram', visual: 'Concept', caption: 'Caption' },
        { type: 'closing', title: 'Thanks' },
      ],
      { topic: 'T', colors: SLIDE_COLOR_THEMES.professional },
    );

    expect(html).toContain('class="agenda-item"');
    expect(html).toContain('class="numbered-item"');
    expect(html).toContain('class="big-number-value"');
    expect(html).toContain('class="comparison-grid"');
    expect(html).toContain('class="visual-frame"');
    expect(html).toContain('hero-kicker');
  });
});

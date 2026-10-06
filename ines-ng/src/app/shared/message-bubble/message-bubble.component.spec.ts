import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MessageBubbleComponent, renderMessageHtml } from './message-bubble.component';

// The component uses templateUrl/styleUrl, which are only resolved at build time
// in AOT. In JIT (Vitest), we must resolve them from disk before TestBed touches
// the component definition. Components and specs are co-located, so resolve URLs
// relative to this spec file's directory.
const specDir = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await ɵresolveComponentResources((url) => readFile(resolve(specDir, url), 'utf-8'));
});

/** Applies the same sanitizer the component uses in `safeHtml()`. */
function sanitize(html: string): string {
  const sanitizer = TestBed.inject(DomSanitizer);
  return sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
}

describe('MessageBubbleComponent', () => {
  it('should create', async () => {
    await TestBed.configureTestingModule({
      imports: [MessageBubbleComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(MessageBubbleComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});

describe('renderMessageHtml', () => {
  it('should return empty string for empty text', () => {
    expect(renderMessageHtml('', 'ai', sanitize)).toBe('');
  });

  it('should escape HTML in user messages', () => {
    const html = renderMessageHtml('<script>alert(1)</script>', 'user', sanitize);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should render markdown for AI messages', () => {
    const html = renderMessageHtml('**bold**', 'ai', sanitize);
    expect(html).toContain('<strong>bold</strong>');
  });

  it('should strip event handler attributes from AI markdown (XSS regression)', () => {
    const html = renderMessageHtml(
      '<img src="x" onerror="alert(1)">',
      'ai',
      sanitize,
    ).toLowerCase();
    expect(html).not.toContain('onerror');
  });

  it('should neutralize javascript: URLs from AI markdown (XSS regression)', () => {
    const html = renderMessageHtml('[click](javascript:alert(1))', 'ai', sanitize).toLowerCase();
    // Angular's sanitizer keeps the URL but makes it inert by prefixing it
    // with `unsafe:`. A live `href="javascript:"` must never appear.
    expect(html).not.toContain('href="javascript:');
  });

  it('should remove script tags from AI markdown', () => {
    const html = renderMessageHtml('<script>alert(1)</script>', 'ai', sanitize);
    expect(html).not.toContain('<script');
  });
});

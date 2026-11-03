import { describe, it, expect } from 'vitest';
import {
  buildGmailQuery,
  sanitizeFilename,
  sanitizeHeaderValue,
  sanitizeMimeType,
} from './gmail.service';

describe('buildGmailQuery', () => {
  it('defaults to the inbox', () => {
    expect(buildGmailQuery()).toBe('in:inbox');
  });

  it('appends labels as OR terms', () => {
    expect(buildGmailQuery(['scontrini', 'ricevute'])).toBe(
      'in:inbox OR label:"scontrini" OR label:"ricevute"',
    );
  });

  it('ignores empty labels and strips quotes', () => {
    expect(buildGmailQuery([' scontrini ', '', '"casa"'])).toBe(
      'in:inbox OR label:"scontrini" OR label:"casa"',
    );
  });
});

describe('sanitizeHeaderValue', () => {
  it('collapses CR/LF to spaces', () => {
    expect(sanitizeHeaderValue('a\r\nb')).toBe('a b');
    expect(sanitizeHeaderValue('a\r\n\r\nb')).toBe('a b');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeHeaderValue('  subject  ')).toBe('subject');
  });
});

describe('sanitizeMimeType', () => {
  it('keeps a valid type/subtype', () => {
    expect(sanitizeMimeType('application/pdf')).toBe('application/pdf');
    expect(sanitizeMimeType('image/svg+xml')).toBe('image/svg+xml');
  });

  it('falls back for injected or malformed values', () => {
    expect(sanitizeMimeType('text/plain\r\nBcc: x@y.z')).toBe('application/octet-stream');
    expect(sanitizeMimeType('text/plain; name="x"')).toBe('application/octet-stream');
    expect(sanitizeMimeType('')).toBe('application/octet-stream');
  });
});

describe('sanitizeFilename', () => {
  it('keeps normal filenames', () => {
    expect(sanitizeFilename('fattura.pdf')).toBe('fattura.pdf');
  });

  it('neutralises CR/LF and quotes', () => {
    expect(sanitizeFilename('a.txt"\r\nBcc: x@y.z')).toBe('a.txt Bcc: x@y.z');
  });

  it('falls back to a default when empty', () => {
    expect(sanitizeFilename('')).toBe('attachment');
    expect(sanitizeFilename('  "  ')).toBe('attachment');
  });
});

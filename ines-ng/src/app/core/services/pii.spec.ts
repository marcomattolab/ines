import { describe, it, expect } from 'vitest';
import { detectPii, joinWords, wordsForMatch } from './pii';
import { OcrWord } from './ocr.service';

describe('pii service — detectPii', () => {
  it('detects email addresses', () => {
    const text = 'Contattami a mario.rossi@example.com per info.';
    const matches = detectPii(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe('Email');
    expect(matches[0].value).toBe('mario.rossi@example.com');
  });

  it('detects and validates valid IBAN', () => {
    // Valid Italian IBAN
    const text = 'Bonifico su IT60X0542811101000000123456 grazie';
    const matches = detectPii(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe('IBAN');
    expect(matches[0].value).toBe('IT60X0542811101000000123456');
  });

  it('rejects invalid IBAN checksum', () => {
    const text = 'Bonifico su IT00X0000000000000000000000 grazie';
    const matches = detectPii(text);
    const ibanMatch = matches.find((m) => m.kind === 'IBAN');
    expect(ibanMatch).toBeUndefined();
  });

  it('detects Italian Codice Fiscale', () => {
    const text = 'CF: RSSMRA85M01H501Z del dichiarante';
    const matches = detectPii(text);
    expect(matches.some((m) => m.kind === 'Tax code' && m.value === 'RSSMRA85M01H501Z')).toBe(true);
  });

  it('detects valid credit card number conforming to Luhn', () => {
    // 4532 0151 1284 3211 passes Luhn algorithm
    const text = 'Carta: 4532 0151 1284 3211';
    const matches = detectPii(text);
    const cardMatch = matches.find((m) => m.kind === 'Payment card');
    expect(cardMatch).toBeDefined();
    expect(cardMatch?.value).toBe('4532 0151 1284 3211');
  });

  it('rejects credit card number with invalid Luhn', () => {
    const text = 'Carta: 4532 0151 1284 3212';
    const matches = detectPii(text);
    const cardMatch = matches.find((m) => m.kind === 'Payment card');
    expect(cardMatch).toBeUndefined();
  });

  it('detects Italian Partita IVA', () => {
    // Partita IVA with valid checksum (12345678903)
    const text = 'P.IVA 12345678903';
    const matches = detectPii(text);
    const pivaMatch = matches.find((m) => m.kind === 'VAT number');
    expect(pivaMatch).toBeDefined();
    expect(pivaMatch?.value).toBe('12345678903');
  });

  it('detects Italian mobile and landline telephone numbers', () => {
    const text = 'Cell: +39 340 1234567 oppure fisso 02 1234567';
    const matches = detectPii(text);
    const phones = matches.filter((m) => m.kind === 'Phone');
    expect(phones.length).toBeGreaterThanOrEqual(1);
  });

  it('detects IPv4 addresses', () => {
    const text = 'Server host: 192.168.1.100 port 80';
    const matches = detectPii(text);
    const ipMatch = matches.find((m) => m.kind === 'IP address');
    expect(ipMatch).toBeDefined();
    expect(ipMatch?.value).toBe('192.168.1.100');
  });

  it('returns empty array when no PII is present', () => {
    const text = 'Questo è un testo semplice senza informazioni sensibili.';
    expect(detectPii(text)).toEqual([]);
  });

  it('detects custom terms (e.g. names)', () => {
    const text = 'Il paziente Mario Rossi è stato dimesso oggi.';
    const matches = detectPii(text, { terms: [{ value: 'Mario Rossi', label: 'Name' }] });
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe('Name');
    expect(matches[0].value).toBe('Mario Rossi');
  });

  it('detects medical terms only when the category is enabled', () => {
    const text = 'Diagnosi: diabete tipo 2 con ipertensione.';
    expect(detectPii(text).some((m) => m.kind === 'Medical')).toBe(false);
    const matches = detectPii(text, { kinds: new Set(['medical']) });
    const kinds = matches.map((m) => m.kind);
    expect(kinds).toContain('Medical');
    expect(kinds.every((k) => k === 'Medical')).toBe(true);
  });

  it('only runs the enabled rule categories', () => {
    const text = 'Contattami a mario.rossi@example.com o al 02 1234567.';
    const matches = detectPii(text, { kinds: new Set(['phone']) });
    expect(matches.every((m) => m.kind === 'Phone')).toBe(true);
    expect(matches.some((m) => m.value.includes('@'))).toBe(false);
  });

  it('detects capitalized first names via the names category', () => {
    const text = 'Il signor Mario e la signora Giulia sono arrivati.';
    const matches = detectPii(text, { kinds: new Set(['names']) });
    expect(matches.every((m) => m.kind === 'Name')).toBe(true);
    expect(matches.map((m) => m.value)).toEqual(expect.arrayContaining(['Mario', 'Giulia']));
  });

  it('ignores lowercase words that also look like names', () => {
    const text = 'la rosa e il bruno del quadro';
    expect(detectPii(text, { kinds: new Set(['names']) })).toEqual([]);
  });

  it('detects capitalized surnames via the surnames category', () => {
    const text = 'Contratto di Mario Rossi e Anna Bianchi.';
    const matches = detectPii(text, { kinds: new Set(['surnames']) });
    expect(matches.every((m) => m.kind === 'Surname')).toBe(true);
    expect(matches.map((m) => m.value)).toEqual(expect.arrayContaining(['Rossi', 'Bianchi']));
  });
});

describe('pii service — joinWords & wordsForMatch', () => {
  it('joins words with spaces and computes spans accurately', () => {
    const words: OcrWord[] = [
      { text: 'Conto', x0: 10, y0: 10, x1: 50, y1: 20 },
      { text: 'IT60X0542811101000000123456', x0: 60, y0: 10, x1: 200, y1: 20 },
    ];
    const { text, spans } = joinWords(words);
    expect(text).toBe('Conto IT60X0542811101000000123456');
    expect(spans).toHaveLength(2);
    expect(spans[0]).toEqual({ start: 0, end: 5 });
    expect(spans[1]).toEqual({ start: 6, end: 33 });

    const matches = detectPii(text);
    expect(matches).toHaveLength(1);
    const matchedWordIndices = wordsForMatch(spans, matches[0]);
    expect(matchedWordIndices).toEqual([1]);
  });

  it('handles empty words array in joinWords', () => {
    const { text, spans } = joinWords([]);
    expect(text).toBe('');
    expect(spans).toEqual([]);
  });
});

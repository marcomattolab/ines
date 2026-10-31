import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { TestBed } from '@angular/core/testing';
import { ExpenseService, Expense } from './expense.service';
import { LlmService } from './llm.service';
import { JsonParserService } from './json-parser.service';
import { GmailService } from './gmail.service';
import { TextProcessingService } from './text-processing.service';
import { DomUtilsService } from './dom-utils.service';
import { OcrService } from './ocr.service';
import { StorageService } from './storage.service';

function makeExpense(partial: Partial<Expense>): Expense {
  return {
    id: 'e1',
    description: 'Test',
    category: 'casa',
    amount: 100,
    date: '2026-03-10',
    recurrence: 'once',
    sourceType: 'manual',
    createdAt: 0,
    ...partial,
  };
}

describe('ExpenseService — month amortisation', () => {
  let svc: ExpenseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ExpenseService,
        { provide: LlmService, useValue: {} },
        { provide: JsonParserService, useValue: {} },
        { provide: GmailService, useValue: {} },
        { provide: TextProcessingService, useValue: {} },
        { provide: DomUtilsService, useValue: {} },
        { provide: OcrService, useValue: {} },
        { provide: StorageService, useValue: { get: () => null, set: () => {}, remove: () => {} } },
      ],
    });
    svc = TestBed.inject(ExpenseService);
  });

  it('counts a one-off expense only in its own month', () => {
    const e = makeExpense({ date: '2026-03-10', amount: 100, recurrence: 'once' });
    expect(svc.monthlyShare(e, 2026, 3)).toBe(100);
    expect(svc.monthlyShare(e, 2026, 4)).toBeNull();
  });

  it('spreads a bimonthly expense across two months', () => {
    const e = makeExpense({ date: '2026-03-10', amount: 120, recurrence: 'bimonthly' });
    expect(svc.monthlyShare(e, 2026, 3)).toBe(60);
    expect(svc.monthlyShare(e, 2026, 4)).toBe(60);
    expect(svc.monthlyShare(e, 2026, 5)).toBeNull();
  });

  it('spreads an annual expense across twelve months', () => {
    const e = makeExpense({ date: '2026-01-15', amount: 600, recurrence: 'annual' });
    expect(svc.monthlyShare(e, 2026, 1)).toBe(50);
    expect(svc.monthlyShare(e, 2026, 12)).toBe(50);
    expect(svc.monthlyShare(e, 2027, 1)).toBeNull();
  });

  it('keeps a monthly expense in every following month', () => {
    const e = makeExpense({ date: '2026-03-10', amount: 30, recurrence: 'monthly' });
    expect(svc.monthlyShare(e, 2026, 3)).toBe(30);
    expect(svc.monthlyShare(e, 2026, 9)).toBe(30);
    expect(svc.monthlyShare(e, 2026, 2)).toBeNull();
  });

  it('stops a monthly expense at its end date', () => {
    const e = makeExpense({
      date: '2026-03-10',
      endDate: '2026-05-31',
      amount: 30,
      recurrence: 'monthly',
    });
    expect(svc.monthlyShare(e, 2026, 3)).toBe(30);
    expect(svc.monthlyShare(e, 2026, 5)).toBe(30);
    expect(svc.monthlyShare(e, 2026, 6)).toBeNull();
  });

  it('computes category totals for a month', () => {
    svc.expenses.set([
      makeExpense({
        id: 'a',
        date: '2026-03-01',
        amount: 100,
        recurrence: 'once',
        category: 'luce',
      }),
      makeExpense({
        id: 'b',
        date: '2026-03-02',
        amount: 200,
        recurrence: 'once',
        category: 'luce',
      }),
      makeExpense({
        id: 'c',
        date: '2026-03-03',
        amount: 50,
        recurrence: 'once',
        category: 'cibo',
      }),
    ]);
    const totals = svc.categoryTotals(2026, 3);
    const luce = totals.find((t) => t.category === 'luce');
    const cibo = totals.find((t) => t.category === 'cibo');
    expect(luce?.total).toBe(300);
    expect(cibo?.total).toBe(50);
    expect(svc.monthlyTotal(2026, 3)).toBe(350);
  });

  it('renders a Markdown summary with the monthly total', () => {
    svc.expenses.set([
      makeExpense({
        id: 'a',
        date: '2026-03-01',
        amount: 100,
        recurrence: 'once',
        category: 'luce',
      }),
    ]);
    const md = svc.generateMarkdown(2026, 3);
    expect(md).toContain('Spese Casa');
    expect(md).toContain('Luce');
    expect(md).toContain('€ 100.00');
  });
});

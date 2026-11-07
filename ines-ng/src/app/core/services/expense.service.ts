import { Injectable, inject, signal, computed } from '@angular/core';
import { LlmService } from './llm.service';
import { JsonParserService } from './json-parser.service';
import { GmailService, GmailFullEmail, GmailAttachment } from './gmail.service';
import { TextProcessingService } from './text-processing.service';
import { DomUtilsService } from './dom-utils.service';
import { OcrService } from './ocr.service';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';

export type ExpenseCategory =
  | 'acqua'
  | 'luce'
  | 'gas'
  | 'telefono'
  | 'internet'
  | 'cibo'
  | 'vestiti'
  | 'bellezza'
  | 'salute'
  | 'trasporti'
  | 'casa'
  | 'altro';

export type ExpenseRecurrence = 'once' | 'monthly' | 'bimonthly' | 'quarterly' | 'annual';

export interface ExpenseAttachment {
  name: string;
  link: string;
}

export type ExpenseSourceType = 'email' | 'telegram' | 'manual';

export interface Expense {
  id: string;
  description: string;
  vendor?: string;
  category: ExpenseCategory;
  amount: number;
  /** ISO date (YYYY-MM-DD) of the expense. */
  date: string;
  /** Optional end date for recurring expenses (stops them appearing after it). */
  endDate?: string;
  recurrence: ExpenseRecurrence;
  sourceType: ExpenseSourceType;
  sourceLabel?: string;
  /** Link to the source email/telegram message. */
  sourceLink?: string;
  attachmentName?: string;
  /** Link to the PDF/image resource (data URL or URL). */
  attachmentLink?: string;
  /** All attachments (multi-attachment emails). */
  attachments?: ExpenseAttachment[];
  /** Raw source message id (Gmail message id / Telegram message id). */
  sourceId?: string;
  /** Deduplication key computed from source + amount + date. */
  dedupKey?: string;
  note?: string;
  /** Family nucleus (household) this expense belongs to. */
  nucleusId?: string;
  createdAt: number;
}

export interface ExpenseCategoryDef {
  value: ExpenseCategory;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

export interface ExpenseRecurrenceDef {
  value: ExpenseRecurrence;
  label: string;
  periodMonths: number;
}

export interface CategorizedExpense {
  isExpense: boolean;
  description?: string;
  vendor?: string;
  category?: ExpenseCategory;
  amount?: number;
  date?: string;
  recurrence?: ExpenseRecurrence;
  nucleusId?: string;
}

export interface Nucleus {
  id: string;
  name: string;
  /** First names of the household members (used to match "dentista di Andrea"). */
  members: string[];
  /** Billing addresses / street names (used to match "luce di via ..."). */
  addresses: string[];
}

export const EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  {
    value: 'acqua',
    label: 'Water',
    icon: 'water_drop',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
  },
  {
    value: 'luce',
    label: 'Electricity',
    icon: 'bolt',
    color: 'text-amber-300',
    bg: 'bg-amber-300/10',
  },
  {
    value: 'gas',
    label: 'Gas',
    icon: 'local_fire_department',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    value: 'telefono',
    label: 'Phone',
    icon: 'smartphone',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  {
    value: 'internet',
    label: 'Internet',
    icon: 'wifi',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    value: 'cibo',
    label: 'Food',
    icon: 'restaurant',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    value: 'vestiti',
    label: 'Clothing',
    icon: 'checkroom',
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-400/10',
  },
  {
    value: 'bellezza',
    label: 'Beauty',
    icon: 'spa',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
  },
  {
    value: 'salute',
    label: 'Health',
    icon: 'favorite',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
  },
  {
    value: 'trasporti',
    label: 'Transport',
    icon: 'directions_car',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
  },
  { value: 'casa', label: 'Home', icon: 'home', color: 'text-violet-400', bg: 'bg-violet-400/10' },
  {
    value: 'altro',
    label: 'Other',
    icon: 'more_horiz',
    color: 'text-zinc-400',
    bg: 'bg-zinc-400/10',
  },
];

export const EXPENSE_RECURRENCES: ExpenseRecurrenceDef[] = [
  { value: 'once', label: 'One-time', periodMonths: 1 },
  { value: 'monthly', label: 'Monthly', periodMonths: 1 },
  { value: 'bimonthly', label: 'Bimonthly', periodMonths: 2 },
  { value: 'quarterly', label: 'Quarterly', periodMonths: 3 },
  { value: 'annual', label: 'Annual', periodMonths: 12 },
];

const DB_NAME = 'InesExpensesDB';
const DB_VERSION = 1;
const STORE = 'expenses';

const SYSTEM_CATEGORIZE = `You are a home-expense parsing agent. You receive a text (from an email, a Telegram chat message, or a receipt) and must extract expense information.

Respond ONLY with a JSON object (no markdown, no backticks) in this format:
{
  "isExpense": true,
  "description": "short description of the expense",
  "vendor": "company or shop name",
  "category": "acqua|luce|gas|telefono|internet|cibo|vestiti|bellezza|salute|trasporti|casa|altro",
  "amount": 42.5,
  "date": "YYYY-MM-DD",
  "recurrence": "once|monthly|bimonthly|quarterly|annual",
  "nucleus": "A"
}

Rules:
- If the text is NOT about an expense, return {"isExpense": false}.
- "amount" is a positive number in EUR (null if not found). Ignore the euro symbol.
- "recurrence": "monthly" for monthly bills (e.g. phone, internet, streaming), "bimonthly" for bimonthly bills, "annual" for yearly fees, "once" otherwise.
- Use "today" only when no date can be inferred; prefer explicit dates in the text.
- "category" must be one of the allowed values.
- "nucleus" is the letter (A, B, ...) of the family nucleus the expense belongs to, chosen from the nuclei list provided below. Match by the person name (e.g. "dentista di Andrea") or by the billing address (e.g. "via ...") mentioned in the text. If nothing matches, use "A".`;

const SYSTEM_QUERY = `You are a personal home-finance assistant. Answer questions about home expenses using ONLY the Markdown data provided below. Reply in the user's language (usually English). Be concise and always include euro amounts when relevant. If the data does not contain the answer, say so.`;

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly llm = inject(LlmService);
  private readonly jsonParser = inject(JsonParserService);
  private readonly gmail = inject(GmailService);
  private readonly textProc = inject(TextProcessingService);
  private readonly dom = inject(DomUtilsService);
  private readonly ocr = inject(OcrService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  readonly expenses = signal<Expense[]>([]);
  readonly currency = signal<string>(this.storage.get<string>('ines_expense_currency') ?? '€');
  readonly loading = signal(false);
  readonly scanning = signal(false);
  readonly categorizing = signal(false);
  readonly scanLog = signal<string[]>([]);
  readonly scanProgress = signal(0);
  readonly scanTotal = signal(0);
  readonly scanAdded = signal(0);
  /** Extra Gmail labels to scan (comma-separated), e.g. "scontrini, ricevute". */
  readonly scanLabels = signal<string>(this.storage.get<string>('ines_expense_scan_labels') ?? '');
  /** Number of emails to scan manually (0 = all). */
  readonly scanMax = signal<number>(this.storage.get<number>('ines_expense_scan_max') ?? 0);
  /** Family nuclei (households) used to split expenses. */
  readonly nuclei = signal<Nucleus[]>(this.loadNuclei());
  /** Budgets per nucleus: nucleusId -> (category -> amount). */
  readonly budgets = signal<Record<string, Partial<Record<ExpenseCategory, number>>>>(
    this.loadBudgets(),
  );

  // Auto-scan email (periodic background polling)
  readonly autoScan = signal<boolean>(this.storage.get<boolean>('ines_expense_autoscan') ?? false);
  readonly autoScanMinutes = signal<number>(
    this.storage.get<number>('ines_expense_autoscan_minutes') ?? 60,
  );
  readonly lastScanAt = signal<number | null>(null);
  /** Expenses detected in the background since the user last opened the tab. */
  readonly unseenCount = signal(0);

  markSeen(): void {
    this.unseenCount.set(0);
  }

  private db: IDBDatabase | null = null;
  private autoScanTimer: ReturnType<typeof setInterval> | null = null;
  private autoScanFirstRun: ReturnType<typeof setTimeout> | null = null;
  private initPromise: Promise<void> | null = null;

  readonly categories = EXPENSE_CATEGORIES;
  readonly recurrences = EXPENSE_RECURRENCES;

  readonly categoryMap = computed(() => {
    const map = new Map<string, ExpenseCategoryDef>();
    for (const c of this.categories) map.set(c.value, c);
    return map;
  });

  constructor() {
    void this.load();
    if (this.autoScan()) this.startAutoScan();
  }

  // ── IndexedDB persistence ──

  private ensureDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in this environment'));
    }
    if (this.db) return Promise.resolve(this.db);
    if (this.initPromise) return this.initPromise.then(() => this.db!);
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    return this.initPromise.then(() => this.db!);
  }

  private async getAll(): Promise<Expense[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private async put(expense: Expense): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(expense);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async removeRecord(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async clearRecords(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    this.loading.set(true);
    try {
      const list = await this.getAll();
      list.sort((a, b) => (a.date < b.date ? 1 : -1));
      this.expenses.set(list);
    } catch (e) {
      console.error('Failed to load expenses:', e);
    } finally {
      this.loading.set(false);
    }
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'exp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  async add(
    expense: Omit<Expense, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
  ): Promise<Expense> {
    const full: Expense = {
      id: expense.id ?? this.newId(),
      createdAt: expense.createdAt ?? Date.now(),
      description: expense.description,
      vendor: expense.vendor,
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      endDate: expense.endDate,
      recurrence: expense.recurrence,
      sourceType: expense.sourceType,
      sourceLabel: expense.sourceLabel,
      sourceLink: expense.sourceLink,
      attachmentName: expense.attachmentName,
      attachmentLink: expense.attachmentLink,
      attachments: expense.attachments,
      sourceId: expense.sourceId,
      dedupKey: expense.dedupKey,
      note: expense.note,
      nucleusId: expense.nucleusId,
    };
    await this.put(full);
    this.expenses.update((list) => [...list, full].sort((a, b) => (a.date < b.date ? 1 : -1)));
    return full;
  }

  async remove(id: string): Promise<void> {
    await this.removeRecord(id);
    this.expenses.update((list) => list.filter((e) => e.id !== id));
  }

  async clearAll(): Promise<void> {
    await this.clearRecords();
    this.expenses.set([]);
  }

  // ── Auto-scan email ──

  setAutoScan(enabled: boolean): void {
    this.autoScan.set(enabled);
    this.storage.set('ines_expense_autoscan', enabled);
    if (enabled) {
      this.startAutoScan();
    } else {
      this.stopAutoScan();
    }
  }

  setAutoScanMinutes(minutes: number): void {
    const m = Math.max(5, Math.round(minutes) || 60);
    this.autoScanMinutes.set(m);
    this.storage.set('ines_expense_autoscan_minutes', m);
    if (this.autoScan() && this.autoScanTimer) {
      this.stopAutoScan();
      this.startAutoScan();
    }
  }

  startAutoScan(): void {
    this.stopAutoScan();
    if (!this.autoScan()) return;
    const intervalMs = this.autoScanMinutes() * 60 * 1000;
    this.autoScanTimer = setInterval(() => void this.tickAutoScan(), intervalMs);
    // Kick off a first scan shortly after enabling (model may still be loading).
    this.autoScanFirstRun = setTimeout(() => void this.tickAutoScan(), 5000);
  }

  stopAutoScan(): void {
    if (this.autoScanTimer) {
      clearInterval(this.autoScanTimer);
      this.autoScanTimer = null;
    }
    if (this.autoScanFirstRun) {
      clearTimeout(this.autoScanFirstRun);
      this.autoScanFirstRun = null;
    }
  }

  private async tickAutoScan(): Promise<void> {
    if (!this.llm.isReady() || !this.gmail.configured()) return;
    if (this.scanning()) return;
    try {
      const added = await this.scanEmails(50);
      this.lastScanAt.set(Date.now());
      if (added > 0) {
        this.toast.success(`Auto-scan: ${added} new expenses detected`);
      }
    } catch {
      /* background scan errors are non-fatal */
    }
  }

  // ── Month helpers (handles bimonthly/annual amortisation) ──

  periodMonths(rec: ExpenseRecurrence): number {
    return this.recurrences.find((r) => r.value === rec)?.periodMonths ?? 1;
  }

  categoryDef(cat: ExpenseCategory): ExpenseCategoryDef {
    return this.categoryMap().get(cat) ?? this.categories[this.categories.length - 1];
  }

  /**
   * Returns the monthly share for a given expense if it applies to the month,
   * or null otherwise. Recurring expenses are spread across their period.
   */
  monthlyShare(expense: Expense, year: number, month: number): number | null {
    const start = new Date(expense.date + 'T00:00:00');
    const startKey = start.getFullYear() * 12 + (start.getMonth() + 1);
    const targetKey = year * 12 + month;
    if (targetKey < startKey) return null;
    if (targetKey > this.endKeyOf(expense)) return null;

    const months = this.periodMonths(expense.recurrence);
    if (expense.recurrence === 'once') {
      return targetKey === startKey ? expense.amount : null;
    }
    if (expense.recurrence === 'monthly') {
      // Recurring monthly items keep showing until the optional end date.
      return expense.amount;
    }
    // bimonthly / quarterly / annual: spread over the period starting at the expense date.
    return Math.round((expense.amount / months) * 100) / 100;
  }

  /** Month key (year*12 + month) after which the expense no longer applies. */
  private endKeyOf(expense: Expense): number {
    const start = new Date(expense.date + 'T00:00:00');
    const startKey = start.getFullYear() * 12 + (start.getMonth() + 1);
    const months = this.periodMonths(expense.recurrence);

    let natural: number;
    if (expense.recurrence === 'monthly') {
      natural = Number.MAX_SAFE_INTEGER;
    } else {
      natural = startKey + months - 1;
    }

    if (expense.endDate) {
      const end = new Date(expense.endDate + 'T00:00:00');
      const endKey = end.getFullYear() * 12 + (end.getMonth() + 1);
      return Math.min(natural, endKey);
    }
    return natural;
  }

  expensesForMonth(
    year: number,
    month: number,
    nucleusId?: string,
  ): { expense: Expense; share: number }[] {
    let items = this.expenses()
      .map((expense) => ({ expense, share: this.monthlyShare(expense, year, month) }))
      .filter((x): x is { expense: Expense; share: number } => x.share !== null);
    if (nucleusId) {
      items = items.filter((x) => this.nucleusOf(x.expense).id === nucleusId);
    }
    return items;
  }

  monthlyTotal(year: number, month: number, nucleusId?: string): number {
    return this.expensesForMonth(year, month, nucleusId).reduce((sum, x) => sum + x.share, 0);
  }

  categoryTotals(
    year: number,
    month: number,
    nucleusId?: string,
  ): { category: ExpenseCategory; total: number }[] {
    const map = new Map<ExpenseCategory, number>();
    for (const { expense, share } of this.expensesForMonth(year, month, nucleusId)) {
      map.set(expense.category, (map.get(expense.category) ?? 0) + share);
    }
    return this.categories
      .filter((c) => map.has(c.value))
      .map((c) => ({ category: c.value, total: Math.round(map.get(c.value)! * 100) / 100 }));
  }

  // ── Budgets (persisted in localStorage) ──

  budgetFor(cat: ExpenseCategory, nucleusId?: string): number | null {
    if (!nucleusId) return null;
    const v = this.budgets()[nucleusId]?.[cat];
    return typeof v === 'number' && v > 0 ? v : null;
  }

  setBudget(nucleusId: string, cat: ExpenseCategory, amount: number | null): void {
    this.budgets.update((b) => {
      const next: Record<string, Partial<Record<ExpenseCategory, number>>> = { ...b };
      const nucleusBudgets: Partial<Record<ExpenseCategory, number>> = {
        ...(next[nucleusId] ?? {}),
      };
      if (amount === null || amount <= 0) delete nucleusBudgets[cat];
      else nucleusBudgets[cat] = amount;
      next[nucleusId] = nucleusBudgets;
      return next;
    });
    this.storage.set('ines_expense_budgets', this.budgets());
  }

  setCurrency(symbol: string): void {
    const sym = symbol.trim() || '€';
    this.currency.set(sym);
    this.storage.set('ines_expense_currency', sym);
  }

  setScanLabels(value: string): void {
    this.scanLabels.set(value);
    this.storage.set('ines_expense_scan_labels', value);
  }

  setScanMax(value: number): void {
    const n = Math.max(0, Math.round(value) || 0);
    this.scanMax.set(n);
    this.storage.set('ines_expense_scan_max', n);
  }

  private loadNuclei(): Nucleus[] {
    const saved = this.storage.get<Nucleus[]>('ines_expense_nuclei');
    if (Array.isArray(saved) && saved.length) return saved;
    return [
      { id: 'nucleo-1', name: 'Our home', members: [], addresses: [] },
      { id: 'nucleo-2', name: "Dad's home", members: [], addresses: [] },
    ];
  }

  private loadBudgets(): Record<string, Partial<Record<ExpenseCategory, number>>> {
    const saved = this.storage.get<unknown>('ines_expense_budgets');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    const record = saved as Record<string, Partial<Record<ExpenseCategory, number>>>;
    // Migrate the legacy flat shape (category -> amount) to the first nucleus.
    const categoryKeys = new Set(EXPENSE_CATEGORIES.map((c) => c.value));
    const keys = Object.keys(record);
    if (keys.some((k) => categoryKeys.has(k as ExpenseCategory))) {
      const first = this.nuclei()[0]?.id;
      return first ? { [first]: record as Partial<Record<ExpenseCategory, number>> } : {};
    }
    return record;
  }

  addNucleus(name = 'New household'): void {
    const nucleus: Nucleus = {
      id:
        'nucleo-' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      name,
      members: [],
      addresses: [],
    };
    this.nuclei.update((list) => [...list, nucleus]);
    this.storage.set('ines_expense_nuclei', this.nuclei());
  }

  updateNucleus(id: string, patch: Partial<Omit<Nucleus, 'id'>>): void {
    this.nuclei.update((list) => list.map((n) => (n.id === id ? { ...n, ...patch, id } : n)));
    this.storage.set('ines_expense_nuclei', this.nuclei());
  }

  removeNucleus(id: string): void {
    this.nuclei.update((list) => {
      const next = list.filter((n) => n.id !== id);
      return next.length ? next : list;
    });
    this.storage.set('ines_expense_nuclei', this.nuclei());
  }

  nucleusOf(expense: Expense): Nucleus {
    const nuclei = this.nuclei();
    if (expense.nucleusId) {
      const found = nuclei.find((n) => n.id === expense.nucleusId);
      if (found) return found;
    }
    return nuclei[0] ?? { id: '', name: 'N/A', members: [], addresses: [] };
  }

  nucleusName(id: string | undefined): string {
    const nuclei = this.nuclei();
    if (id) {
      const found = nuclei.find((n) => n.id === id);
      if (found) return found.name;
    }
    return nuclei[0]?.name ?? '';
  }

  /** Stable dedup key from source id + amount + date (djb2 hash). */
  dedupKeyOf(
    sourceType: ExpenseSourceType,
    sourceId: string | undefined,
    amount: number,
    date: string,
  ): string {
    const raw = `${sourceType}|${sourceId || ''}|${amount}|${date}`;
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
    }
    return 'dedup_' + (hash >>> 0).toString(36);
  }

  /**
   * Reconciliation across sources: an expense is a duplicate when the same
   * description + amount already exists in the same month (e.g. a Telegram
   * expense that also arrives as a tracking email).
   */
  private findDuplicate(parsed: CategorizedExpense): boolean {
    const desc = (parsed.description || '').trim().toLowerCase();
    const month = (parsed.date || '').slice(0, 7);
    const amount = parsed.amount;
    if (!desc || !month || amount === undefined) return false;
    return this.expenses().some((e) => {
      if (e.date.slice(0, 7) !== month) return false;
      if (Math.abs(e.amount - amount) > 0.009) return false;
      return e.description.trim().toLowerCase() === desc;
    });
  }

  // ── Markdown generation ──

  generateMarkdown(year: number, month: number, nucleusId?: string): string {
    const items = this.expensesForMonth(year, month, nucleusId);
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    const total = this.monthlyTotal(year, month, nucleusId);
    const cur = this.currency();

    const lines: string[] = [];
    lines.push(`# Home Expenses — ${monthLabel}`);
    lines.push('');
    lines.push(`> Generated by INES on ${new Date().toLocaleString('en-US')}`);
    lines.push('');

    if (items.length === 0) {
      lines.push('_No expenses recorded this month._');
      return lines.join('\n');
    }

    lines.push(
      '| Category | Household | Description | Vendor | Monthly share | Frequency | Original amount | Source | Attachment |',
    );
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const { expense, share } of items) {
      const cat = this.categoryDef(expense.category).label;
      const freq =
        this.recurrences.find((r) => r.value === expense.recurrence)?.label ?? expense.recurrence;
      const source = expense.sourceLink
        ? `[${expense.sourceLabel || expense.sourceType}](${expense.sourceLink})`
        : expense.sourceLabel || expense.sourceType;
      const atts = expense.attachments?.length
        ? expense.attachments
        : expense.attachmentLink
          ? [{ name: expense.attachmentName || 'attachment', link: expense.attachmentLink }]
          : [];
      const attachment = atts
        .map((a, i) => `[${a.name || 'attachment ' + (i + 1)}](${a.link})`)
        .join(' ');
      lines.push(
        `| ${cat} | ${this.mdEscape(this.nucleusName(expense.nucleusId))} | ${this.mdEscape(expense.description)} | ${this.mdEscape(expense.vendor || '')} | ${cur} ${share.toFixed(2)} | ${freq} | ${cur} ${expense.amount.toFixed(2)} | ${source} | ${attachment} |`,
      );
    }
    lines.push('');
    lines.push(`## Total ${monthLabel}: **${cur} ${total.toFixed(2)}**`);
    lines.push('');
    lines.push('## Total by category');
    lines.push('');
    for (const ct of this.categoryTotals(year, month, nucleusId)) {
      lines.push(`- **${this.categoryDef(ct.category).label}**: ${cur} ${ct.total.toFixed(2)}`);
    }
    lines.push('');
    lines.push('## Total by household');
    lines.push('');
    for (const n of this.nuclei()) {
      lines.push(`- **${n.name}**: ${cur} ${this.monthlyTotal(year, month, n.id).toFixed(2)}`);
    }
    lines.push('');
    lines.push('## Recurring / amortized expenses');
    lines.push('');
    const recurring = items.filter((x) => x.expense.recurrence !== 'once');
    if (recurring.length === 0) {
      lines.push('_No recurring expenses this month._');
    } else {
      for (const { expense, share } of recurring) {
        const freq =
          this.recurrences.find((r) => r.value === expense.recurrence)?.label ?? expense.recurrence;
        const end = expense.endDate ? ` · until ${expense.endDate}` : '';
        lines.push(
          `- ${expense.description} — ${cur} ${expense.amount.toFixed(2)} (${freq}) → ${cur} ${share.toFixed(2)}/month${end}`,
        );
      }
    }

    return lines.join('\n');
  }

  private mdEscape(text: string): string {
    return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }

  async downloadMonthMd(year: number, month: number): Promise<boolean> {
    const md = this.generateMarkdown(year, month);
    const name = `home-expenses-${year}-${String(month).padStart(2, '0')}.md`;
    return this.dom.saveTextFile(md, name, 'text/markdown');
  }

  async downloadYearMd(year: number): Promise<boolean> {
    const md = this.generateYearMarkdown(year);
    const name = `home-expenses-${year}.md`;
    return this.dom.saveTextFile(md, name, 'text/markdown');
  }

  async exportJson(): Promise<boolean> {
    return this.dom.saveTextFile(
      JSON.stringify(this.expenses(), null, 2),
      'home-expenses.json',
      'application/json',
    );
  }

  // ── CSV export ──

  private csvCell(value: string | number | undefined): string {
    const s = String(value ?? '');
    if (/[",;\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  private csvRowsForMonth(year: number, month: number): string[][] {
    return this.expensesForMonth(year, month).map(({ expense, share }) => {
      const cat = this.categoryDef(expense.category).label;
      const freq =
        this.recurrences.find((r) => r.value === expense.recurrence)?.label ?? expense.recurrence;
      const source = expense.sourceLink || expense.sourceLabel || expense.sourceType;
      const attachments = expense.attachments?.length
        ? expense.attachments
        : expense.attachmentLink
          ? [{ name: expense.attachmentName || 'attachment', link: expense.attachmentLink }]
          : [];
      const attachment = attachments.map((a) => a.link || a.name).join(' ');
      return [
        expense.date,
        this.nucleusName(expense.nucleusId),
        cat,
        expense.description,
        expense.vendor || '',
        expense.amount.toFixed(2),
        share.toFixed(2),
        freq,
        source,
        attachment,
      ];
    });
  }

  generateMonthCsv(year: number, month: number): string {
    const header = [
      'date',
      'household',
      'category',
      'description',
      'vendor',
      'amount',
      'monthly share',
      'frequency',
      'source',
      'attachment',
    ];
    const rows = this.csvRowsForMonth(year, month);
    return [header, ...rows].map((r) => r.map((c) => this.csvCell(c)).join(',')).join('\n');
  }

  generateYearCsv(year: number): string {
    const header = [
      'month',
      'date',
      'household',
      'category',
      'description',
      'vendor',
      'amount',
      'monthly share',
      'frequency',
      'source',
      'attachment',
    ];
    const rows: string[][] = [];
    for (let m = 1; m <= 12; m++) {
      const label = new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
      for (const row of this.csvRowsForMonth(year, m)) {
        rows.push([label, ...row]);
      }
    }
    return [header, ...rows].map((r) => r.map((c) => this.csvCell(c)).join(',')).join('\n');
  }

  async downloadMonthCsv(year: number, month: number): Promise<boolean> {
    const csv = this.generateMonthCsv(year, month);
    const name = `home-expenses-${year}-${String(month).padStart(2, '0')}.csv`;
    return this.dom.saveTextFile(csv, name, 'text/csv');
  }

  async downloadYearCsv(year: number): Promise<boolean> {
    const csv = this.generateYearCsv(year);
    const name = `home-expenses-${year}.csv`;
    return this.dom.saveTextFile(csv, name, 'text/csv');
  }

  // ── LLM categorisation ──

  async categorize(text: string): Promise<CategorizedExpense | null> {
    if (!this.llm.isReady()) throw new Error('Load the model first!');
    const raw = await this.llm.generate(this.categorizeSystemPrompt(), text, [], () => undefined);
    const parsed = this.jsonParser.parseObject(raw);
    if (!parsed) return null;
    if (parsed['isExpense'] === false) return { isExpense: false };
    const category = (parsed['category'] as string) || 'altro';
    const validCategories = this.categories.map((c) => c.value);
    const recurrence = (parsed['recurrence'] as string) || 'once';
    return {
      isExpense: true,
      description: (parsed['description'] as string) || 'Expense',
      vendor: (parsed['vendor'] as string) || undefined,
      category: validCategories.includes(category as ExpenseCategory)
        ? (category as ExpenseCategory)
        : 'altro',
      amount: typeof parsed['amount'] === 'number' ? parsed['amount'] : undefined,
      date: (parsed['date'] as string) || new Date().toISOString().slice(0, 10),
      recurrence: this.recurrences.some((r) => r.value === recurrence)
        ? (recurrence as ExpenseRecurrence)
        : 'once',
      nucleusId: this.parseNucleus(parsed['nucleus']),
    };
  }

  private categorizeSystemPrompt(): string {
    const nuclei = this.nuclei();
    if (!nuclei.length) return SYSTEM_CATEGORIZE;
    const list = nuclei
      .map((n, i) => {
        const letter = String.fromCharCode(65 + i);
        const members = n.members.length ? n.members.join(', ') : 'no members';
        const addresses = n.addresses.length ? n.addresses.join(', ') : 'no addresses';
        return `${letter}) ${n.name} — members: ${members}; addresses: ${addresses}`;
      })
      .join('\n');
    return `${SYSTEM_CATEGORIZE}\n\nHouseholds:\n${list}\n\nAssign "nucleus" to the letter of the household the expense belongs to, based on the person mentioned (e.g. "Andrea's dentist") or the billing address (e.g. "via ..."). If nothing matches, use "A".`;
  }

  private parseNucleus(raw: unknown): string | undefined {
    const nuclei = this.nuclei();
    if (!nuclei.length) return undefined;
    const s = String(raw ?? '').trim();
    let idx = -1;
    if (/^[A-Za-z]$/.test(s)) {
      idx = s.toUpperCase().charCodeAt(0) - 65;
    } else if (s) {
      idx = nuclei.findIndex((n) => n.name.toLowerCase() === s.toLowerCase());
    }
    if (idx < 0 || idx >= nuclei.length) idx = 0;
    return nuclei[idx].id;
  }

  /** Converts a local File into a data URL (capped at ~8 MB to avoid oversized records). */
  private async fileToDataUrl(file: File): Promise<string | null> {
    if (file.size > 8 * 1024 * 1024) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  // ── Email scanning ──

  async scanEmails(maxTotal?: number): Promise<number> {
    if (!this.llm.isReady()) throw new Error('Load the model first!');
    this.scanning.set(true);
    this.scanLog.set([]);
    this.scanProgress.set(0);
    this.scanTotal.set(0);
    this.scanAdded.set(0);
    let added = 0;
    try {
      const labels = this.scanLabels()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // Without maxTotal the scan walks every Gmail page (whole history).
      const total = maxTotal ?? Number.MAX_SAFE_INTEGER;
      const pageSize = 50;
      // Fast skip: don't re-fetch messages already imported in a previous scan.
      const knownSourceIds = new Set(
        this.expenses()
          .map((e) => e.sourceId)
          .filter((id): id is string => !!id),
      );
      const emails = await this.gmail.fetchFullMessages(pageSize, labels, total, knownSourceIds);
      this.scanTotal.set(emails.length);
      this.log(
        labels.length
          ? `Fetched ${emails.length} emails (inbox + labels: ${labels.join(', ')}).`
          : `Fetched ${emails.length} emails from inbox.`,
      );

      for (const email of emails) {
        this.scanProgress.update((n) => n + 1);
        // Self-generated tracking emails are a trace, not a new expense.
        if (email.subject.trim().startsWith('[Expenses]')) {
          this.log(`⏭ ${email.subject.slice(0, 40)} — tracking email skipped`);
          continue;
        }
        if (knownSourceIds.has(email.id)) {
          this.log(`⏭ ${email.subject.slice(0, 40)} — already imported`);
          continue;
        }
        try {
          const text = await this.emailToText(email);
          const parsed = await this.categorize(text);
          if (!parsed || !parsed.isExpense) continue;
          if (parsed.amount === undefined) continue;
          const date = parsed.date || new Date().toISOString().slice(0, 10);
          const dedupKey = this.dedupKeyOf('email', email.id, parsed.amount, date);
          if (this.expenses().some((e) => e.dedupKey === dedupKey)) continue;
          if (this.findDuplicate(parsed)) {
            this.log(`⏭ ${parsed.description} — already present (reconciliation)`);
            continue;
          }
          const attachments: ExpenseAttachment[] = email.attachments.map((a) => ({
            name: a.filename,
            link: a.dataUrl,
          }));
          const firstAtt = email.attachments[0];
          await this.add({
            description: parsed.description || email.subject,
            vendor: parsed.vendor,
            category: parsed.category || 'altro',
            amount: parsed.amount,
            date,
            recurrence: parsed.recurrence || 'once',
            sourceType: 'email',
            sourceLabel: email.from,
            sourceLink: `https://mail.google.com/mail/u/0/#inbox/${email.id}`,
            sourceId: email.id,
            dedupKey,
            attachmentName: firstAtt?.filename,
            attachmentLink: firstAtt?.dataUrl,
            attachments,
            note: email.subject,
            nucleusId: parsed.nucleusId,
          });
          added++;
          this.scanAdded.set(added);
          this.log(`✓ ${parsed.description} — € ${parsed.amount.toFixed(2)} (${parsed.category})`);
        } catch (e: any) {
          this.log(`⚠ ${email.subject.slice(0, 40)} — ${e?.message ?? 'error'}`);
        }
      }
      if (added === 0) this.log('No new expenses detected.');
      if (added > 0) this.unseenCount.update((n) => n + added);
      return added;
    } finally {
      this.scanning.set(false);
    }
  }

  private async emailToText(email: GmailFullEmail): Promise<string> {
    const parts: string[] = [];
    parts.push(`Subject: ${email.subject}`);
    parts.push(`From: ${email.from}`);
    if (email.labels.length) parts.push(`Gmail labels: ${email.labels.join(', ')}`);
    if (email.body) parts.push(`Body:\n${email.body.slice(0, 4000)}`);
    for (const att of email.attachments) {
      parts.push(`Attachment: ${att.filename} (${att.mimeType})`);
      const extracted = await this.extractAttachmentDataUrlText(att);
      if (extracted) parts.push(`Attachment text:\n${extracted.slice(0, 3000)}`);
    }
    return parts.join('\n');
  }

  /** Extracts readable text from a Gmail PDF/DOCX/image attachment (data URL). */
  private async extractAttachmentDataUrlText(att: GmailAttachment): Promise<string> {
    try {
      const ext = att.filename.split('.').pop()?.toLowerCase();
      const res = await fetch(att.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], att.filename, { type: att.mimeType });
      if (['pdf', 'docx', 'txt', 'md', 'html', 'pptx'].includes(ext || '')) {
        return await this.textProc.extractTextFromFile(file);
      }
      if (att.mimeType.startsWith('image/')) {
        return await this.ocr.recognize(file);
      }
      return '';
    } catch {
      return '';
    }
  }

  private log(msg: string): void {
    this.scanLog.update((list) => [...list, msg]);
  }

  // ── Telegram / manual import ──

  /**
   * Parses a Telegram-style message (text + optional image/PDF) into an
   * expense and returns it. Optionally creates/sends a tracking email in
   * Gmail so the email remains the single source of truth.
   */
  async addFromTelegram(
    text: string,
    file?: File,
    sourceId?: string,
  ): Promise<{ expense: Expense; parsed: CategorizedExpense }> {
    let fullText = text;
    let attachment: { filename: string; mimeType: string; dataUrl: string } | undefined;

    if (file) {
      const dataUrl = await this.fileToDataUrl(file);
      const extracted = await this.extractAttachmentText(file);
      if (extracted) fullText += `\n\nAttachment (${file.name}):\n${extracted.slice(0, 3000)}`;
      attachment = {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl: dataUrl ?? '',
      };
    }

    const parsed = await this.categorize(fullText);
    if (!parsed || !parsed.isExpense || parsed.amount === undefined) {
      throw new Error('Could not detect an expense in this message.');
    }

    const date = parsed.date || new Date().toISOString().slice(0, 10);
    const dedupKey = this.dedupKeyOf('telegram', sourceId, parsed.amount, date);
    const expense = await this.add({
      description: parsed.description || 'Expense',
      vendor: parsed.vendor,
      category: parsed.category || 'altro',
      amount: parsed.amount,
      date,
      recurrence: parsed.recurrence || 'once',
      sourceType: 'telegram',
      sourceLabel: 'Telegram',
      sourceId,
      dedupKey,
      attachmentName: file?.name,
      attachmentLink: attachment?.dataUrl || undefined,
      attachments: attachment
        ? [{ name: attachment.filename, link: attachment.dataUrl }]
        : undefined,
      note: text.slice(0, 200),
      nucleusId: parsed.nucleusId,
    });

    return { expense, parsed };
  }

  private async extractAttachmentText(file: File): Promise<string> {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['pdf', 'docx', 'txt', 'md', 'html', 'pptx'].includes(ext || '')) {
        return await this.textProc.extractTextFromFile(file);
      }
      if (file.type.startsWith('image/')) {
        const text = await this.ocr.recognize(file);
        return text || `[Image: ${file.name} — no text detected]`;
      }
    } catch {
      /* ignore */
    }
    return '';
  }

  /** Builds the tracking email body + subject for a given expense. */
  buildTrackingEmail(expense: Expense): { subject: string; body: string } {
    const cat = this.categoryDef(expense.category).label;
    const freq =
      this.recurrences.find((r) => r.value === expense.recurrence)?.label ?? expense.recurrence;
    const subject = `[Expenses] ${cat} — ${expense.description}`;
    const body = [
      `Expense recorded by INES`,
      '',
      `- Category: ${cat}`,
      `- Household: ${this.nucleusName(expense.nucleusId)}`,
      `- Description: ${expense.description}`,
      `- Vendor: ${expense.vendor || '-'}`,
      `- Amount: ${this.currency()} ${expense.amount.toFixed(2)}`,
      `- Date: ${expense.date}`,
      `- Frequency: ${freq}`,
      `- Source: ${expense.sourceType}`,
      '',
      'This email is the source of truth for expense tracking.',
    ].join('\n');
    return { subject, body };
  }

  /** Builds the attachment list for a tracking email from an expense record. */
  expenseAttachments(expense: Expense): { filename: string; mimeType: string; dataUrl: string }[] {
    const list = expense.attachments?.length
      ? expense.attachments
      : expense.attachmentLink
        ? [{ name: expense.attachmentName || 'attachment', link: expense.attachmentLink }]
        : [];
    return list.map((a) => ({
      filename: a.name,
      mimeType: a.link.split(';')[0].split(':')[1] || 'application/octet-stream',
      dataUrl: a.link,
    }));
  }

  /**
   * Full ingestion pipeline for an incoming Telegram message: categorise,
   * store locally, then create/send the tracking email in Gmail so the email
   * remains the single source of truth.
   */
  async ingestTelegram(
    text: string,
    file?: File,
    emailMode: 'draft' | 'send' | 'none' = 'draft',
    sourceId?: string,
  ): Promise<{ expense: Expense; parsed: CategorizedExpense; emailed: boolean }> {
    const { expense, parsed } = await this.addFromTelegram(text, file, sourceId);
    let emailed = false;
    if (emailMode !== 'none' && this.gmail.configured()) {
      const { subject, body } = this.buildTrackingEmail(expense);
      const attachments = this.expenseAttachments(expense);
      if (emailMode === 'send') {
        await this.gmail.sendEmail(subject, body, attachments);
      } else {
        await this.gmail.createDraft(subject, body, attachments);
      }
      emailed = true;
    }
    return { expense, parsed, emailed };
  }

  async answerQuestion(question: string, year: number, month: number): Promise<string> {
    if (!this.llm.isReady()) throw new Error('Load the model first!');
    const md = this.generateMarkdown(year, month);
    const context = `Expense data for the selected month:\n\n${md}\n\nQuestion: ${question}`;
    return this.llm.generate(SYSTEM_QUERY, context, [], () => undefined);
  }

  async answerYearQuestion(question: string, year: number): Promise<string> {
    if (!this.llm.isReady()) throw new Error('Load the model first!');
    const md = this.generateYearMarkdown(year);
    const context = `Expense data for the year:\n\n${md}\n\nQuestion: ${question}`;
    return this.llm.generate(SYSTEM_QUERY, context, [], () => undefined);
  }

  // ── Editing & import ──

  async update(id: string, patch: Partial<Expense>): Promise<void> {
    const existing = this.expenses().find((e) => e.id === id);
    if (!existing) return;
    const merged: Expense = { ...existing, ...patch, id };
    await this.put(merged);
    this.expenses.update((list) =>
      list.map((e) => (e.id === id ? merged : e)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    );
  }

  async importExpenses(list: unknown): Promise<number> {
    if (!Array.isArray(list)) throw new Error('Invalid JSON file: expected a list of expenses.');
    const rawList = list as Partial<Expense>[];
    const existingKeys = new Set(this.expenses().map((e) => e.dedupKey || e.id));
    let added = 0;
    for (const raw of rawList) {
      if (!raw || typeof raw !== 'object') continue;
      if (typeof raw.amount !== 'number' || !raw.description) continue;
      const dedupKey =
        raw.dedupKey ||
        this.dedupKeyOf(
          (raw.sourceType as ExpenseSourceType) || 'manual',
          raw.sourceId,
          raw.amount,
          raw.date || new Date().toISOString().slice(0, 10),
        );
      if (existingKeys.has(dedupKey) || (raw.id && existingKeys.has(raw.id))) continue;
      await this.add({
        id: raw.id,
        createdAt: raw.createdAt,
        description: raw.description,
        vendor: raw.vendor,
        category: (raw.category as ExpenseCategory) || 'altro',
        amount: raw.amount,
        date: raw.date || new Date().toISOString().slice(0, 10),
        endDate: raw.endDate,
        recurrence: raw.recurrence || 'once',
        sourceType: (raw.sourceType as ExpenseSourceType) || 'manual',
        sourceLabel: raw.sourceLabel,
        sourceLink: raw.sourceLink,
        attachmentName: raw.attachmentName,
        attachmentLink: raw.attachmentLink,
        attachments: raw.attachments,
        sourceId: raw.sourceId,
        dedupKey,
        note: raw.note,
        nucleusId: raw.nucleusId,
      });
      existingKeys.add(dedupKey);
      if (raw.id) existingKeys.add(raw.id);
      added++;
    }
    return added;
  }

  // ── Year aggregates ──

  yearTotal(year: number, nucleusId?: string): number {
    let sum = 0;
    for (let m = 1; m <= 12; m++) sum += this.monthlyTotal(year, m, nucleusId);
    return sum;
  }

  yearlyTotals(year: number, nucleusId?: string): { month: number; total: number }[] {
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total: this.monthlyTotal(year, i + 1, nucleusId),
    }));
  }

  yearlyCategoryTotals(
    year: number,
    nucleusId?: string,
  ): { category: ExpenseCategory; total: number }[] {
    const map = new Map<ExpenseCategory, number>();
    for (let m = 1; m <= 12; m++) {
      for (const { expense, share } of this.expensesForMonth(year, m, nucleusId)) {
        map.set(expense.category, (map.get(expense.category) ?? 0) + share);
      }
    }
    return this.categories
      .filter((c) => map.has(c.value))
      .map((c) => ({ category: c.value, total: Math.round(map.get(c.value)! * 100) / 100 }));
  }

  generateYearMarkdown(year: number): string {
    const cur = this.currency();
    const lines: string[] = [`# Home Expenses — Year ${year}`, ''];
    lines.push('| Month | Total |');
    lines.push('|---|---|');
    for (let m = 1; m <= 12; m++) {
      const t = this.monthlyTotal(year, m);
      const label = new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
      lines.push(`| ${label} | ${cur} ${t.toFixed(2)} |`);
    }
    lines.push('');
    lines.push(`## Year total ${year}: **${cur} ${this.yearTotal(year).toFixed(2)}**`);
    lines.push('');
    lines.push('## Total by category (year)');
    lines.push('');
    for (const ct of this.yearlyCategoryTotals(year)) {
      lines.push(`- **${this.categoryDef(ct.category).label}**: ${cur} ${ct.total.toFixed(2)}`);
    }
    return lines.join('\n');
  }
}

import { Component, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  ExpenseService,
  Expense,
  ExpenseCategory,
  ExpenseRecurrence,
  ExpenseSourceType,
} from '../../core/services/expense.service';
import { GmailService } from '../../core/services/gmail.service';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { TelegramService } from '../../core/services/telegram.service';
import { OcrService } from '../../core/services/ocr.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

type Panel = 'dashboard' | 'add' | 'scan' | 'ask';

@Component({
  selector: 'app-expenses-tab',
  standalone: true,
  imports: [FormsModule, MatIconModule, ButtonComponent],
  templateUrl: './expenses-tab.component.html',
  styleUrl: './expenses-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class ExpensesTabComponent {
  readonly expenseSvc = inject(ExpenseService);
  readonly gmail = inject(GmailService);
  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  readonly telegram = inject(TelegramService);
  readonly ocr = inject(OcrService);

  readonly now = new Date();
  readonly year = signal(this.now.getFullYear());
  readonly month = signal(this.now.getMonth() + 1);
  readonly panel = signal<Panel>('dashboard');

  readonly panels: { id: Panel; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'add', label: 'Aggiungi', icon: 'add_circle' },
    { id: 'scan', label: 'Scan Email', icon: 'mail' },
    { id: 'ask', label: 'Chiedi', icon: 'help' },
  ];

  // Manual add form
  readonly mDescription = signal('');
  readonly mAmount = signal<number | null>(null);
  readonly mDate = signal(this.todayIso());
  readonly mEndDate = signal('');
  readonly mVendor = signal('');
  readonly mCategory = signal<ExpenseCategory>('casa');
  readonly mRecurrence = signal<ExpenseRecurrence>('once');
  readonly mSourceType = signal<ExpenseSourceType>('manual');
  readonly mSourceLabel = signal('');
  readonly mSourceLink = signal('');
  readonly mAttachmentLink = signal('');
  readonly mAttachmentName = signal('');

  // Telegram import form
  readonly tText = signal('');
  readonly tFile = signal<File | null>(null);
  readonly tFileName = signal('');
  readonly tEmailMode = signal<'draft' | 'send'>('draft');

  // Telegram bot (long polling) config
  readonly tBotToken = signal(this.telegram.botToken());
  readonly tChatId = signal(this.telegram.chatId());
  private processedTelegram = new Set<string>();

  constructor() {
    // Auto-ingest messages received from the Telegram bot.
    effect(() => {
      const items = this.telegram.incoming();
      for (const item of items) {
        if (this.processedTelegram.has(item.id)) continue;
        this.processedTelegram.add(item.id);
        void this.handleIncoming(item);
      }
    });
  }

  // Ask form
  readonly question = signal('');
  readonly answer = signal('');
  readonly asking = signal(false);

  readonly monthLabel = computed(() =>
    new Date(this.year(), this.month() - 1, 1).toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric',
    }),
  );

  readonly monthItems = computed(() => this.expenseSvc.expensesForMonth(this.year(), this.month()));
  readonly total = computed(() => this.expenseSvc.monthlyTotal(this.year(), this.month()));
  readonly catTotals = computed(() => this.expenseSvc.categoryTotals(this.year(), this.month()));
  readonly prevTotal = computed(() => {
    let y = this.year();
    let m = this.month() - 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    return this.expenseSvc.monthlyTotal(y, m);
  });
  readonly delta = computed(() => this.total() - this.prevTotal());
  readonly trend = computed(() => {
    const out: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let y = this.year();
      let m = this.month() - i;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      out.push({
        label: new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'short' }),
        total: this.expenseSvc.monthlyTotal(y, m),
      });
    }
    return out;
  });
  readonly trendMax = computed(() => Math.max(1, ...this.trend().map((t) => t.total)));
  readonly showBudgets = signal(false);
  readonly viewMode = signal<'month' | 'year'>('month');
  readonly searchQuery = signal('');
  readonly editingId = signal<string | null>(null);
  readonly askScope = signal<'month' | 'year'>('month');

  readonly filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const items = this.monthItems();
    if (!q) return items;
    return items.filter(
      (x) =>
        x.expense.description.toLowerCase().includes(q) ||
        (x.expense.vendor || '').toLowerCase().includes(q),
    );
  });

  readonly yearTotals = computed(() => this.expenseSvc.yearlyTotals(this.year()));
  readonly yearTotal = computed(() => this.expenseSvc.yearTotal(this.year()));
  readonly yearCatTotals = computed(() => this.expenseSvc.yearlyCategoryTotals(this.year()));
  readonly yearMax = computed(() => Math.max(1, ...this.yearTotals().map((t) => t.total)));

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  recurrenceLabel(rec: ExpenseRecurrence): string {
    return this.expenseSvc.recurrences.find((r) => r.value === rec)?.label ?? rec;
  }

  budgetFor(cat: ExpenseCategory): number | null {
    return this.expenseSvc.budgetFor(cat);
  }

  isOverBudget(cat: ExpenseCategory, total: number): boolean {
    const b = this.expenseSvc.budgetFor(cat);
    return b !== null && total > b;
  }

  budgetValue(cat: ExpenseCategory): string | number {
    const b = this.expenseSvc.budgetFor(cat);
    return b === null ? '' : b;
  }

  updateBudget(cat: ExpenseCategory, value: string): void {
    const n = parseFloat(value);
    this.expenseSvc.setBudget(cat, isNaN(n) || n <= 0 ? null : n);
  }

  prevMonth(): void {
    this.month.update((m) => {
      if (m === 1) {
        this.year.update((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }

  nextMonth(): void {
    this.month.update((m) => {
      if (m === 12) {
        this.year.update((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }

  setToday(): void {
    this.year.set(this.now.getFullYear());
    this.month.set(this.now.getMonth() + 1);
  }

  prevYear(): void {
    this.year.update((y) => y - 1);
  }

  nextYear(): void {
    this.year.update((y) => y + 1);
  }

  monthShort(m: number): string {
    return new Date(2000, m - 1, 1).toLocaleDateString('it-IT', { month: 'short' });
  }

  async addManual(): Promise<void> {
    const amount = this.mAmount();
    const description = this.mDescription().trim();
    if (!description || amount === null || amount <= 0) {
      this.toast.show('Inserisci descrizione e importo validi');
      return;
    }
    const data = {
      description,
      amount,
      date: this.mDate() || this.todayIso(),
      endDate: this.mEndDate() || undefined,
      vendor: this.mVendor().trim() || undefined,
      category: this.mCategory(),
      recurrence: this.mRecurrence(),
      sourceType: this.mSourceType(),
      sourceLabel: this.mSourceLabel().trim() || undefined,
      sourceLink: this.mSourceLink().trim() || undefined,
      attachmentName: this.mAttachmentName().trim() || undefined,
      attachmentLink: this.mAttachmentLink().trim() || undefined,
    };
    const editing = this.editingId();
    if (editing) {
      await this.expenseSvc.update(editing, data);
      this.toast.success('Spesa aggiornata');
    } else {
      await this.expenseSvc.add(data);
      this.toast.success('Spesa aggiunta');
    }
    this.resetManual();
  }

  editExpense(expense: Expense): void {
    this.editingId.set(expense.id);
    this.mDescription.set(expense.description);
    this.mAmount.set(expense.amount);
    this.mDate.set(expense.date);
    this.mEndDate.set(expense.endDate || '');
    this.mVendor.set(expense.vendor || '');
    this.mCategory.set(expense.category);
    this.mRecurrence.set(expense.recurrence);
    this.mSourceType.set(expense.sourceType);
    this.mSourceLabel.set(expense.sourceLabel || '');
    this.mSourceLink.set(expense.sourceLink || '');
    this.mAttachmentName.set(expense.attachmentName || '');
    this.mAttachmentLink.set(expense.attachmentLink || '');
    this.panel.set('add');
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.resetManual();
  }

  async onImportJson(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const added = await this.expenseSvc.importExpenses(data);
      this.toast.success(
        added > 0 ? `${added} spese importate` : 'Nessuna nuova spesa da importare',
      );
    } catch (e: any) {
      this.toast.error(e?.message ?? 'Import fallito');
    }
    input.value = '';
  }

  private resetManual(): void {
    this.editingId.set(null);
    this.mDescription.set('');
    this.mAmount.set(null);
    this.mDate.set(this.todayIso());
    this.mEndDate.set('');
    this.mVendor.set('');
    this.mCategory.set('casa');
    this.mRecurrence.set('once');
    this.mSourceType.set('manual');
    this.mSourceLabel.set('');
    this.mSourceLink.set('');
    this.mAttachmentLink.set('');
    this.mAttachmentName.set('');
  }

  onTelegramFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.tFile.set(file);
    this.tFileName.set(file?.name ?? '');
  }

  async importFromTelegram(): Promise<void> {
    const text = this.tText().trim();
    if (!text && !this.tFile()) {
      this.toast.show('Incolla il messaggio Telegram o allega un file');
      return;
    }
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }
    this.expenseSvc.categorizing.set(true);
    try {
      const { expense, emailed } = await this.expenseSvc.ingestTelegram(
        text,
        this.tFile() ?? undefined,
        this.tEmailMode(),
      );
      this.toast.success(`Spesa classificata: ${expense.description}`);
      this.tText.set('');
      this.tFile.set(null);
      this.tFileName.set('');
      if (emailed) {
        this.toast.success(
          this.tEmailMode() === 'send'
            ? 'Email di tracciamento inviata'
            : 'Bozza email di tracciamento creata in Gmail',
        );
      }
    } catch (e: any) {
      this.toast.error(e?.message ?? 'Errore durante la classificazione');
    } finally {
      this.expenseSvc.categorizing.set(false);
    }
  }

  async trackExpense(expense: Expense, mode: 'draft' | 'send'): Promise<void> {
    if (!this.gmail.configured()) {
      this.toast.error('Configura Gmail (Client ID) prima di creare email di tracciamento');
      return;
    }
    try {
      const { subject, body } = this.expenseSvc.buildTrackingEmail(expense);
      const attachments = this.expenseSvc.expenseAttachments(expense);
      if (mode === 'send') {
        await this.gmail.sendEmail(subject, body, attachments);
        this.toast.success('Email di tracciamento inviata');
      } else {
        await this.gmail.createDraft(subject, body, attachments);
        this.toast.success('Bozza creata in Gmail');
      }
    } catch (e: any) {
      this.toast.error(e?.message ?? 'Errore Gmail');
    }
  }

  saveTelegramConfig(): void {
    this.telegram.saveConfig(this.tBotToken(), this.tChatId());
    this.toast.success('Configurazione Telegram salvata');
  }

  async togglePolling(): Promise<void> {
    if (this.telegram.polling()) {
      this.telegram.stopPolling();
      return;
    }
    try {
      await this.telegram.startPolling();
      this.toast.success('Polling Telegram avviato');
    } catch (e: any) {
      this.toast.error(e?.message ?? 'Errore avvio Telegram');
    }
  }

  private async handleIncoming(item: {
    id: string;
    text: string;
    from: string;
    file?: File;
  }): Promise<void> {
    if (!this.llm.isReady()) {
      this.toast.error('Carica il modello per elaborare i messaggi Telegram');
      return;
    }
    try {
      const { expense, emailed } = await this.expenseSvc.ingestTelegram(
        item.text,
        item.file,
        'draft',
        item.id,
      );
      this.toast.success(`Telegram → ${expense.description}`);
      try {
        const cur = this.expenseSvc.currency();
        const msg = emailed
          ? `✓ Spesa registrata: ${expense.description} (${cur} ${expense.amount.toFixed(2)}) — bozza email creata`
          : `✓ Spesa registrata: ${expense.description} (${cur} ${expense.amount.toFixed(2)})`;
        await this.telegram.sendMessage(msg);
      } catch {
        /* confirmation message is best-effort */
      }
    } catch (e: any) {
      this.toast.error(e?.message ?? 'Errore elaborazione Telegram');
    }
  }

  async scanEmails(): Promise<void> {
    if (!this.gmail.configured()) {
      this.toast.error('Configura Gmail (Client ID) prima di scansionare le email');
      return;
    }
    try {
      const added = await this.expenseSvc.scanEmails(15);
      this.toast.success(added > 0 ? `${added} spese rilevate` : 'Nessuna nuova spesa');
    } catch (e: any) {
      this.toast.error(e?.message ?? 'Errore scansione email');
    }
  }

  async removeExpense(id: string): Promise<void> {
    await this.expenseSvc.remove(id);
    this.toast.success('Spesa eliminata');
  }

  async ask(): Promise<void> {
    const q = this.question().trim();
    if (!q) return;
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }
    this.asking.set(true);
    this.answer.set('');
    try {
      const res =
        this.askScope() === 'year'
          ? await this.expenseSvc.answerYearQuestion(q, this.year())
          : await this.expenseSvc.answerQuestion(q, this.year(), this.month());
      this.answer.set(res);
    } catch (e: any) {
      this.answer.set(e?.message ?? 'Errore');
    } finally {
      this.asking.set(false);
    }
  }

  async downloadMd(): Promise<void> {
    const native = await this.expenseSvc.downloadMonthMd(this.year(), this.month());
    this.toast.success(native ? 'File MD salvato' : 'File MD scaricato');
  }

  async exportJson(): Promise<void> {
    const native = await this.expenseSvc.exportJson();
    this.toast.success(native ? 'File JSON salvato' : 'File JSON scaricato');
  }

  openLink(url?: string): void {
    if (url) window.open(url, '_blank', 'noopener');
  }
}

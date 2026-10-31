import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export interface TelegramIncoming {
  id: string;
  text: string;
  from: string;
  date: number;
  file?: File;
}

const TOKEN_KEY = 'telegram_bot_token';
const CHAT_KEY = 'telegram_chat_id';
const OFFSET_KEY = 'telegram_last_update_id';

/**
 * Minimal Telegram Bot client that runs entirely in the browser via long
 * polling. Messages received from the configured private chat are turned into
 * `TelegramIncoming` items that the expenses agent can categorise.
 */
@Injectable({ providedIn: 'root' })
export class TelegramService {
  private readonly storage = inject(StorageService);

  readonly botToken = signal('');
  readonly chatId = signal('');
  readonly configured = signal(false);
  readonly polling = signal(false);
  readonly lastError = signal('');
  readonly incoming = signal<TelegramIncoming[]>([]);

  private running = false;
  private offset = 0;

  constructor() {
    const token = this.storage.get<string>(TOKEN_KEY);
    const chat = this.storage.get<string>(CHAT_KEY);
    if (token) this.botToken.set(token);
    if (chat) this.chatId.set(chat);
    this.configured.set(!!token && !!chat);
    this.offset = this.storage.get<number>(OFFSET_KEY) ?? 0;
  }

  saveConfig(token: string, chatId: string): void {
    const t = token.trim();
    const c = chatId.trim();
    this.botToken.set(t);
    this.chatId.set(c);
    this.configured.set(!!t && !!c);
    this.lastError.set('');
    if (t) this.storage.set(TOKEN_KEY, t);
    else this.storage.remove(TOKEN_KEY);
    if (c) this.storage.set(CHAT_KEY, c);
    else this.storage.remove(CHAT_KEY);
  }

  async startPolling(): Promise<void> {
    if (!this.botToken()) throw new Error('Inserisci prima il bot token di Telegram.');
    if (this.running) return;
    this.running = true;
    this.polling.set(true);
    this.lastError.set('');

    // On the very first run, skip historical messages by jumping to the latest update.
    if (this.offset === 0) {
      try {
        const latest = await this.getUpdates(0, -1, 1);
        if (latest.length) this.offset = latest[latest.length - 1].update_id;
      } catch {
        /* keep offset 0 and continue */
      }
    }

    try {
      while (this.running) {
        try {
          const updates = await this.getUpdates(25, this.offset + 1, 100);
          for (const u of updates) {
            this.offset = Math.max(this.offset, u.update_id);
            this.storage.set(OFFSET_KEY, this.offset);
            const msg = u.message;
            if (!msg) continue;
            if (this.chatId() && String(msg.chat?.id) !== String(this.chatId())) continue;
            const item = await this.toIncoming(msg);
            if (item) this.incoming.update((list) => [...list, item]);
          }
        } catch (e: any) {
          this.lastError.set(e?.message ?? String(e));
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    } finally {
      this.polling.set(false);
    }
  }

  stopPolling(): void {
    this.running = false;
    this.polling.set(false);
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.botToken() || !this.chatId()) throw new Error('Telegram non configurato');
    const res = await fetch(`https://api.telegram.org/bot${this.botToken()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId(), text }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok)
      throw new Error(data.description || `Telegram API error (${res.status})`);
  }

  private async getUpdates(timeout: number, offset: number, limit: number): Promise<any[]> {
    const url =
      `https://api.telegram.org/bot${this.botToken()}/getUpdates` +
      `?timeout=${timeout}&offset=${offset}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.description || `Telegram API error (${res.status})`);
    }
    return (data.result as any[]) || [];
  }

  private async toIncoming(msg: any): Promise<TelegramIncoming | null> {
    let text: string = msg.text || msg.caption || '';
    let file: File | undefined;

    if (msg.photo && msg.photo.length) {
      const largest = msg.photo[msg.photo.length - 1];
      file = (await this.downloadFile(largest.file_id)) ?? undefined;
    } else if (msg.document) {
      file = (await this.downloadFile(msg.document.file_id)) ?? undefined;
    }

    if (!text && !file) return null;
    return {
      id: `${msg.chat?.id}_${msg.message_id}`,
      text,
      from: msg.from?.first_name || msg.chat?.title || 'Telegram',
      date: msg.date ? msg.date * 1000 : Date.now(),
      file,
    };
  }

  private async downloadFile(fileId: string): Promise<File | null> {
    try {
      const metaRes = await fetch(
        `https://api.telegram.org/bot${this.botToken()}/getFile?file_id=${fileId}`,
      );
      const meta = await metaRes.json();
      if (!meta.ok || !meta.result?.file_path) return null;
      const path = meta.result.file_path;
      const fileRes = await fetch(`https://api.telegram.org/file/bot${this.botToken()}/${path}`);
      const blob = await fileRes.blob();
      const name = path.split('/').pop() || 'allegato';
      return new File([blob], name, { type: blob.type || 'application/octet-stream' });
    } catch {
      return null;
    }
  }
}

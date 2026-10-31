import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export interface GmailEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Inline `data:` URL so the attachment can be opened/downloaded locally. */
  dataUrl: string;
}

export interface GmailFullEmail extends GmailEmail {
  body: string;
  labels: string[];
  attachments: GmailAttachment[];
}

export type GmailStatus = 'unconfigured' | 'configured' | 'connecting' | 'ok' | 'error';

interface GmailPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}

function base64UrlToBase64(data: string): string {
  let b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return b64;
}

function decodeBase64UrlUtf8(data: string): string {
  try {
    const bin = atob(base64UrlToBase64(data));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function dataUrlFromBase64Url(data: string, mimeType: string): string {
  return `data:${mimeType || 'application/octet-stream'};base64,${base64UrlToBase64(data)}`;
}

/** Recursively extracts the plain-text body (prefers text/plain, falls back to HTML). */
function extractBody(payload: GmailPart): string {
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (p: GmailPart) => {
    const mime = p.mimeType || '';
    if (p.body?.data) {
      if (mime === 'text/plain') plain.push(decodeBase64UrlUtf8(p.body.data));
      else if (mime === 'text/html') html.push(decodeBase64UrlUtf8(p.body.data));
    }
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  if (plain.length) return plain.join('\n');
  if (html.length) {
    const doc = new DOMParser().parseFromString(html.join('\n'), 'text/html');
    return doc.body?.textContent || '';
  }
  return payload.body?.data ? decodeBase64UrlUtf8(payload.body.data) : '';
}

function collectAttachments(payload: GmailPart): {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}[] {
  const out: { id: string; filename: string; mimeType: string; size: number }[] = [];
  const walk = (p: GmailPart) => {
    if (p.body?.attachmentId && p.filename) {
      out.push({
        id: p.body.attachmentId,
        filename: p.filename,
        mimeType: p.mimeType || 'application/octet-stream',
        size: p.body.size || 0,
      });
    }
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  return out;
}

const CLIENT_ID_KEY = 'gmail_client_id';
const GMAIL_SCOPE =
  'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose';

/**
 * Builds the Gmail search query for the expenses scan: the inbox plus any
 * user-defined labels (e.g. "scontrini", "ricevute"). Labels are double-quoted
 * so names with spaces work as a single token.
 */
export function buildGmailQuery(labels: string[] = []): string {
  const parts = ['in:inbox'];
  for (const raw of labels) {
    const label = raw.trim().replace(/"/g, '');
    if (label) parts.push(`label:"${label}"`);
  }
  return parts.join(' OR ');
}

@Injectable({ providedIn: 'root' })
export class GmailService {
  private readonly storage = inject(StorageService);

  readonly clientId = signal('');
  readonly configured = signal(false);
  readonly connecting = signal(false);
  readonly status = signal<GmailStatus>('unconfigured');
  readonly lastError = signal('');

  constructor() {
    const saved = this.storage.get<string>(CLIENT_ID_KEY);
    if (saved) {
      this.clientId.set(saved);
      this.configured.set(true);
      this.status.set('configured');
    }
  }

  saveClientId(id: string): void {
    const trimmed = id.trim();
    this.clientId.set(trimmed);
    this.lastError.set('');

    if (!trimmed) {
      this.configured.set(false);
      this.status.set('unconfigured');
      this.storage.remove(CLIENT_ID_KEY);
      return;
    }

    this.configured.set(true);
    this.status.set('configured');
    this.storage.set(CLIENT_ID_KEY, trimmed);

    if (!/\.apps\.googleusercontent\.com$/i.test(trimmed)) {
      this.lastError.set(
        'This does not look like a Google OAuth Client ID — it must end in ".apps.googleusercontent.com".',
      );
    }
  }

  private getAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services is not loaded. Reload the page and try again.'));
        return;
      }
      if (!this.clientId()) {
        reject(new Error('Enter your Google OAuth Client ID first.'));
        return;
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId(),
        scope: GMAIL_SCOPE,
        ux_mode: 'popup',
        callback: (resp: any) => {
          if (resp.error) {
            const code: string = resp.error || '';
            const detail: string = resp.error_description || '';
            if (code === 'invalid_client' || /invalid_client/i.test(detail)) {
              reject(
                new Error(
                  `Google rejected the Client ID ("invalid_client"). Check: 1) it is copied exactly and ends in .apps.googleusercontent.com, 2) its type is "Web application" (not Desktop/TV), 3) it belongs to the project with the Gmail API enabled. A newly created client may need a few minutes to propagate. (${detail})`,
                ),
              );
            } else if (/not a valid origin|origin_mismatch/i.test(detail)) {
              reject(
                new Error(
                  `Origin not allowed by Google: add "http://localhost:4200" (and your production domain) to the Authorized JavaScript origins of this OAuth Client in Google Cloud Console. (${detail})`,
                ),
              );
            } else if (code === 'idpiframe_initialization_failed') {
              reject(
                new Error(
                  'Google sign-in failed to initialize: enable third-party cookies and disable ad-blockers for accounts.google.com.',
                ),
              );
            } else if (code === 'access_denied') {
              reject(new Error('Authorization cancelled.'));
            } else {
              reject(new Error(detail || code));
            }
          } else {
            resolve(resp.access_token);
          }
        },
      });
      client.requestAccessToken();
    });
  }

  async fetchInbox(max = 10): Promise<GmailEmail[]> {
    if (!this.configured()) {
      throw new Error(
        'Gmail is not configured. Set your Google OAuth Client ID in INES Voice settings.',
      );
    }

    this.connecting.set(true);
    this.status.set('connecting');
    this.lastError.set('');

    try {
      const token = await this.getAccessToken();
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=in:inbox`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) {
        let hint = '';
        if (listRes.status === 403) {
          hint = ' Enable the "Gmail API" for this project in Google Cloud Console.';
        } else if (listRes.status === 401) {
          hint = ' Access token was rejected — try again and re-consent.';
        }
        throw new Error(`Gmail API error (${listRes.status}).${hint}`);
      }
      const listData = await listRes.json();
      const messages: { id: string }[] = listData.messages || [];

      // Fetch metadata in parallel, in small batches to avoid rate limits.
      const CONCURRENCY = 8;
      const emails: GmailEmail[] = [];
      const targets = messages.slice(0, max);
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const batch = targets.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (m): Promise<GmailEmail | null> => {
            try {
              const res = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              if (!res.ok) return null;
              const data = await res.json();
              const headers: { name: string; value: string }[] = data.payload?.headers || [];
              const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
              const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
              return { id: m.id, from, subject, snippet: data.snippet || '' };
            } catch {
              return null;
            }
          }),
        );
        for (const r of results) if (r) emails.push(r);
      }

      this.status.set('ok');
      return emails;
    } catch (e: any) {
      this.status.set('error');
      this.lastError.set(e?.message ?? String(e));
      throw e;
    } finally {
      this.connecting.set(false);
    }
  }

  /** Fetches a few emails and returns the count, for the settings "Test" button. */
  async testConnection(): Promise<number> {
    const emails = await this.fetchInbox(3);
    return emails.length;
  }

  /**
   * Fetches full messages (body text + attachments) from the inbox.
   * Used by the home-expenses agent to extract bills/receipts from email.
   */
  async fetchFullMessages(
    max = 10,
    labels: string[] = [],
    maxTotal: number = max,
    knownIds?: Set<string>,
  ): Promise<GmailFullEmail[]> {
    if (!this.configured()) {
      throw new Error(
        'Gmail is not configured. Set your Google OAuth Client ID in INES Voice settings.',
      );
    }

    this.connecting.set(true);
    this.status.set('connecting');
    this.lastError.set('');

    try {
      const token = await this.getAccessToken();
      const query = buildGmailQuery(labels);
      const emails: GmailFullEmail[] = [];
      let pageToken: string | undefined;

      do {
        const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(
          query,
        )}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const listRes = await this.fetchGmail(listUrl, token);
        if (!listRes.ok) {
          const reason = await this.gmailErrorMessage(listRes);
          throw new Error(`Gmail API error (${listRes.status})${reason ? `: ${reason}` : ''}.`);
        }
        const listData = await listRes.json();
        const messages: { id: string }[] = listData.messages || [];
        pageToken = listData.nextPageToken || undefined;
        const targets = messages.slice(0, Math.max(0, maxTotal - emails.length));
        for (const m of targets) {
          if (knownIds?.has(m.id)) continue;
          const email = await this.fetchOneFull(token, m.id);
          if (email) emails.push(email);
          if (emails.length >= maxTotal) break;
          // Throttle each full-message fetch to stay under the Gmail rate limits.
          await this.sleep(250);
        }
        // Throttle between pages to stay under the Gmail rate limits.
        await this.sleep(250);
      } while (pageToken && emails.length < maxTotal);

      this.status.set('ok');
      return emails;
    } catch (e: any) {
      this.status.set('error');
      this.lastError.set(e?.message ?? String(e));
      throw e;
    } finally {
      this.connecting.set(false);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Fetches with retry/backoff on transient Gmail errors (429/403/5xx). */
  private async fetchGmail(url: string, token: string): Promise<Response> {
    let lastRes: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      lastRes = res;
      if (res.ok) return res;
      const retryable = res.status === 429 || res.status === 403 || res.status >= 500;
      if (!retryable || attempt === 3) break;
      await this.sleep(1000 * Math.pow(2, attempt) + Math.random() * 500);
    }
    if (lastRes && !lastRes.ok) {
      const reason = await this.gmailErrorMessage(lastRes.clone());
      console.warn(`[Gmail] ${lastRes.status} ${reason} — ${url.split('?')[0]}`);
    }
    return lastRes!;
  }

  private async gmailErrorMessage(res: Response): Promise<string> {
    try {
      const data = await res.json();
      const reason = data?.error?.errors?.[0]?.reason || data?.error?.message || '';
      return typeof reason === 'string' ? reason : '';
    } catch {
      return '';
    }
  }

  private async fetchOneFull(token: string, id: string): Promise<GmailFullEmail | null> {
    try {
      const res = await this.fetchGmail(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        token,
      );
      if (!res.ok) return null;
      const data = await res.json();
      const headers: { name: string; value: string }[] = data.payload?.headers || [];
      const from = headers.find((h) => h.name === 'From')?.value || 'Unknown';
      const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
      const payload: GmailPart = data.payload || {};

      const attMeta = collectAttachments(payload);
      const attachments: GmailAttachment[] = [];
      for (const a of attMeta) {
        try {
          await this.sleep(150);
          const attRes = await this.fetchGmail(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/attachments/${a.id}`,
            token,
          );
          if (!attRes.ok) continue;
          const attData = await attRes.json();
          if (attData.data) {
            attachments.push({
              id: a.id,
              filename: a.filename,
              mimeType: a.mimeType,
              size: a.size,
              dataUrl: dataUrlFromBase64Url(attData.data, a.mimeType),
            });
          }
        } catch {
          /* skip unreadable attachment */
        }
      }

      return {
        id,
        from,
        subject,
        snippet: data.snippet || '',
        body: extractBody(payload),
        labels: data.labelIds || [],
        attachments,
      };
    } catch {
      return null;
    }
  }

  private buildMime(
    subject: string,
    bodyText: string,
    attachments: { filename: string; mimeType: string; dataUrl: string }[],
  ): string {
    const boundary = 'ines_boundary_' + Math.random().toString(36).slice(2);
    const lines: string[] = [];
    lines.push('MIME-Version: 1.0');
    lines.push(`Subject: ${subject}`);
    lines.push('To: me');
    lines.push('From: me');
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('');
    lines.push(bodyText);
    for (const att of attachments) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      const b64 = att.dataUrl.split(',')[1] || '';
      lines.push(b64.replace(/(.{76})/g, '$1\n'));
    }
    lines.push(`--${boundary}--`);
    return lines.join('\n');
  }

  private base64UrlEncode(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /** Creates a draft email (self-addressed) so the expense can be tracked from the inbox. */
  async createDraft(
    subject: string,
    bodyText: string,
    attachments: { filename: string; mimeType: string; dataUrl: string }[] = [],
  ): Promise<string> {
    if (!this.configured()) throw new Error('Gmail is not configured.');
    const token = await this.getAccessToken();
    const raw = this.base64UrlEncode(this.buildMime(subject, bodyText, attachments));
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { raw } }),
    });
    if (!res.ok) throw new Error(`Gmail draft error (${res.status}).`);
    const data = await res.json();
    return data?.id ?? '';
  }

  /** Sends the tracking email to the user's own inbox (single source of truth). */
  async sendEmail(
    subject: string,
    bodyText: string,
    attachments: { filename: string; mimeType: string; dataUrl: string }[] = [],
  ): Promise<string> {
    if (!this.configured()) throw new Error('Gmail is not configured.');
    const token = await this.getAccessToken();
    const raw = this.base64UrlEncode(this.buildMime(subject, bodyText, attachments));
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) throw new Error(`Gmail send error (${res.status}).`);
    const data = await res.json();
    return data?.id ?? '';
  }
}

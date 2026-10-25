import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export interface GmailEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
}

export type GmailStatus = 'unconfigured' | 'configured' | 'connecting' | 'ok' | 'error';

const CLIENT_ID_KEY = 'gmail_client_id';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

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
}

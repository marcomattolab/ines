import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DomUtilsService {
  escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  async copyToClipboard(text: string): Promise<void> {
    return navigator.clipboard.writeText(text);
  }

  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadText(content: string, filename: string, type = 'text/plain'): void {
    const blob = new Blob([content], { type });
    this.downloadBlob(blob, filename);
  }

  /**
   * Saves text to disk using the File System Access API when available (lets
   * the user pick a real folder/file), falling back to a normal download.
   * Returns true when the native picker was used.
   */
  async saveTextFile(content: string, filename: string, type = 'text/plain'): Promise<boolean> {
    const w = window as unknown as {
      showSaveFilePicker?: (opts: {
        suggestedName?: string;
        types?: { description?: string; accept: Record<string, string[]> }[];
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: string) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    };

    try {
      if (typeof w.showSaveFilePicker === 'function') {
        const ext = filename.split('.').pop() || 'txt';
        const handle = await w.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Document', accept: { [type]: [`.${ext}`] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return false;
      // otherwise fall back to the download below
    }

    this.downloadText(content, filename, type);
    return false;
  }
}

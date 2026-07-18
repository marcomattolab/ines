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
}

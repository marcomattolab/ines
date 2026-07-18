import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  };

  render(text: string): string {
    if (!text) return '';
    let html = text;

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
      const escaped = this.escapeHtml(code.trim());
      return `<pre><code class="language-${lang || 'text'}">${escaped}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    html = html.replace(/\n{2,}/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>(<(h[2-4]|ul|pre)[\s>])/g, '$1');
    html = html.replace(/(<\/(h[2-4]|ul|pre)>)\s*<\/p>/g, '$1');

    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    );

    return html;
  }

  private escapeHtml(text: string): string {
    return text.replace(/[&<>"]/g, (c) => this.escapeMap[c] || c);
  }
}

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SyntaxHighlightService {
  highlight(code: string, lang: string): string {
    const escaped = this.escapeHtml(code);

    switch (lang) {
      case 'typescript':
      case 'ts':
        return this.highlightTypeScript(escaped);
      case 'html':
        return this.highlightHtml(escaped);
      case 'css':
      case 'scss':
        return this.highlightCss(escaped);
      case 'javascript':
      case 'js':
        return this.highlightJavaScript(escaped);
      case 'json':
        return this.highlightJson(escaped);
      default:
        return escaped;
    }
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private highlightTypeScript(escaped: string): string {
    return escaped
      .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;|`[^`]*`)/g, '<span class="hl-string">$1</span>')
      .replace(/(\/\/.*)/g, '<span class="hl-comment">$1</span>')
      .replace(
        /\b(import|export|default|from|const|let|var|function|return|if|else|class|interface|type|enum|extends|implements|new|this|super|async|await|try|catch|throw|finally|typeof|instanceof|readonly|private|protected|public|static|abstract|as|in|of|void|never|unknown|any|boolean|string|number|symbol|null|undefined|true|false|switch|case|break|continue|for|while|do|yield|get|set)\b/g,
        '<span class="hl-keyword">$1</span>',
      )
      .replace(
        /\b(@Component|@Directive|@Pipe|@Injectable|@Input|@Output|@ViewChild|@HostListener|@HostBinding|@NgModule|signal|computed|linkedSignal|input|output|model|viewChild|viewChildren|contentChild|contentChildren|effect|inject|resource|afterRender|afterNextRender|takeUntilDestroyed|outputFromObservable|toSignal|toObservable)\b/g,
        '<span class="hl-decorator">$1</span>',
      )
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  }

  private highlightHtml(escaped: string): string {
    return escaped
      .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="hl-tag">$2</span>')
      .replace(/\/?&gt;/g, '<span class="hl-tag">$&</span>')
      .replace(/(\s[\w-]+)=(&quot;)/g, '<span class="hl-attr">$1</span>=<span class="hl-string">$2')
      .replace(/&quot;/g, '&quot;</span>')
      .replace(/@(\w+)/g, '<span class="hl-decorator">@$1</span>')
      .replace(
        /\b(let|@if|@for|@switch|@defer|@placeholder|@loading|@error|@case|@default|@empty|track)\b/g,
        '<span class="hl-keyword">$1</span>',
      )
      .replace(/({{|}})/g, '<span class="hl-brace">$1</span>');
  }

  private highlightCss(escaped: string): string {
    return escaped
      .replace(/([.#@]?[\w-]+)(?=\s*[{:,])/g, '<span class="hl-selector">$1</span>')
      .replace(/(:\s*)([^;{}]+)/g, '$1<span class="hl-value">$2</span>')
      .replace(/\/\*[\s\S]*?\*\//g, '<span class="hl-comment">$&</span>')
      .replace(
        /@(media|keyframes|import|supports|layer|container|apply|font-face|page|charset|namespace)\b/g,
        '<span class="hl-decorator">$&</span>',
      )
      .replace(/!important/g, '<span class="hl-keyword">!important</span>')
      .replace(
        /(\d+\.?\d*)(px|em|rem|%|vh|vw|ch|ex|deg|s|ms)/g,
        '<span class="hl-number">$1</span>$2',
      );
  }

  private highlightJavaScript(escaped: string): string {
    return escaped
      .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;|`[^`]*`)/g, '<span class="hl-string">$1</span>')
      .replace(/(\/\/.*)/g, '<span class="hl-comment">$1</span>')
      .replace(
        /\b(const|let|var|function|return|if|else|class|extends|new|this|async|await|try|catch|throw|import|export|default|from|typeof|instanceof|null|undefined|true|false)\b/g,
        '<span class="hl-keyword">$1</span>',
      )
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  }

  private highlightJson(escaped: string): string {
    return escaped
      .replace(/(&quot;[^&]*&quot;)/g, '<span class="hl-string">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="hl-keyword">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  }
}

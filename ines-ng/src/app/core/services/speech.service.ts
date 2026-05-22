import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  readonly speaking = signal<boolean>(false);
  readonly activeId = signal<string | null>(null);

  private synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  speak(id: string, text: string, langOrName?: string): void {
    if (!this.synth) return;

    this.stop();

    this.activeId.set(id);
    this.speaking.set(true);

    // Clean text: remove HTML tags or special markdown formatting for speech
    const cleanText = this.stripMarkdownAndHtml(text);

    const utterance = new SpeechSynthesisUtterance(cleanText);

    console.log('langOrName: ', langOrName);
    if (langOrName) {
      const locale = this.getLanguageCode(langOrName);
      utterance.lang = locale;

      // Try to find a premium native voice for this locale
      const voices = this.synth.getVoices();
      const matchedVoice =
        voices.find(
          (v) =>
            (v.lang.toLowerCase() === locale.toLowerCase() ||
              v.lang.toLowerCase().startsWith(locale.split('-')[0].toLowerCase())) &&
            (v.name.toLowerCase().includes('natural') ||
              v.name.toLowerCase().includes('premium') ||
              v.name.toLowerCase().includes('google') ||
              v.name.toLowerCase().includes('siri') ||
              v.name.toLowerCase().includes('microsoft')),
        ) ||
        voices.find(
          (v) =>
            v.lang.toLowerCase() === locale.toLowerCase() ||
            v.lang.toLowerCase().startsWith(locale.split('-')[0].toLowerCase()),
        );

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    }

    utterance.onend = () => this.handleSpeechEnd(id);
    utterance.onerror = () => this.handleSpeechEnd(id);

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  stop(): void {
    if (!this.synth) return;
    this.synth.cancel();
    this.speaking.set(false);
    this.activeId.set(null);
    this.currentUtterance = null;
  }

  toggle(id: string, text: string, langOrName?: string): void {
    if (this.speaking() && this.activeId() === id) {
      this.stop();
    } else {
      this.speak(id, text, langOrName ?? 'en-US');
    }
  }

  private handleSpeechEnd(id: string): void {
    if (this.activeId() === id) {
      this.speaking.set(false);
      this.activeId.set(null);
      this.currentUtterance = null;
    }
  }

  private getLanguageCode(lang: string): string {
    const maps: Record<string, string> = {
      italian: 'it-IT',
      'it-it': 'it-IT',
      english: 'en-US',
      'en-us': 'en-US',
      french: 'fr-FR',
      'fr-fr': 'fr-FR',
      german: 'de-DE',
      'de-de': 'de-DE',
      spanish: 'es-ES',
      'es-es': 'es-ES',
      portuguese: 'pt-PT',
      'pt-pt': 'pt-PT',
      chinese: 'zh-CN',
      'zh-cn': 'zh-CN',
      japanese: 'ja-JP',
      'ja-jp': 'ja-JP',
      arabic: 'ar-SA',
      'ar-sa': 'ar-SA',
      russian: 'ru-RU',
      'ru-ru': 'ru-RU',
    };

    return maps[lang.toLowerCase()] || lang;
  }

  private stripMarkdownAndHtml(text: string): string {
    if (!text) return '';
    // Strip HTML elements
    let result = text.replace(/<\/?[^>]+(>|$)/g, '');

    // Strip common code blocks
    result = result.replace(/```[\s\S]*?```/g, '[Code block omitted]');

    // Strip other markdown syntaxes like **bold** or *italic*
    result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
    result = result.replace(/\*([^*]+)\*/g, '$1');
    result = result.replace(/`([^`]+)`/g, '$1');

    return result;
  }
}

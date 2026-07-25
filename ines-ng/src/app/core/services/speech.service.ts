import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  readonly speaking = signal<boolean>(false);
  readonly activeId = signal<string | null>(null);

  readonly recording = signal(false);
  readonly recordingTimer = signal('');

  private synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  private recognition: any = null;
  private recordingBaseText = '';
  private recordingCallback: ((text: string) => void) | null = null;
  private recordingSeconds = 0;
  private recordingIntervalId: ReturnType<typeof setInterval> | null = null;

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

  startRecording(baseText: string, onResult: (text: string) => void): boolean {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;

    this.recordingBaseText = baseText.trim();
    if (this.recordingBaseText) this.recordingBaseText += ' ';
    this.recordingCallback = onResult;

    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = navigator.language || 'en-US';

    this.recognition.onresult = (e: any) => {
      let interim = '',
        final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      if (final) this.recordingBaseText += this.normalizePunctuation(final);
      const displayText = this.recordingBaseText + (interim ? `[${interim}]` : '');
      this.recordingCallback?.(displayText);
    };

    this.recognition.onerror = () => {};

    this.recognition.onend = () => {
      if (this.recording() && this.recognition) this.recognition.start();
    };

    this.recognition.start();
    this.recording.set(true);
    this.recordingSeconds = 0;

    this.recordingIntervalId = setInterval(() => {
      this.recordingSeconds++;
      const m = Math.floor(this.recordingSeconds / 60)
        .toString()
        .padStart(2, '0');
      const s = (this.recordingSeconds % 60).toString().padStart(2, '0');
      this.recordingTimer.set(`${m}:${s}`);
    }, 1000);

    return true;
  }

  stopRecording(): string {
    if (this.recognition) {
      this.recording.set(false);
      this.recognition.stop();
      this.recognition = null;
    } else {
      this.recording.set(false);
    }
    if (this.recordingIntervalId) {
      clearInterval(this.recordingIntervalId);
      this.recordingIntervalId = null;
    }
    this.recordingTimer.set('');
    const finalText = this.recordingBaseText.trim();
    this.recordingBaseText = '';
    this.recordingCallback = null;
    return finalText;
  }

  abortRecording(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        /* best-effort */
      }
      this.recognition = null;
    }
    this.recording.set(false);
    if (this.recordingIntervalId) {
      clearInterval(this.recordingIntervalId);
      this.recordingIntervalId = null;
    }
    this.recordingTimer.set('');
    this.recordingBaseText = '';
    this.recordingCallback = null;
  }
  private stripMarkdownAndHtml(text: string): string {
    if (!text) return '';
    let result = text.replace(/<\/?[^>]+(>|$)/g, '');
    result = result.replace(/```[\s\S]*?```/g, '[Code block omitted]');
    result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
    result = result.replace(/\*([^*]+)\*/g, '$1');
    result = result.replace(/`([^`]+)`/g, '$1');
    return result;
  }

  private normalizePunctuation(text: string): string {
    const rules: [RegExp, string][] = [
      [/\bcomma\b/gi, ','],
      [/\bperiod\b/gi, '.'],
      [/\bdot\b/gi, '.'],
      [/\bfull stop\b/gi, '.'],
      [/\bquestion mark\b/gi, '?'],
      [/\bexclamation point\b/gi, '!'],
      [/\bexclamation mark\b/gi, '!'],
      [/\bnew line\b/gi, '\n'],
      [/\bnewline\b/gi, '\n'],
      [/\bnext line\b/gi, '\n'],
      [/\bcolon\b/gi, ':'],
      [/\bsemicolon\b/gi, ';'],
      [/\bopen paren\b/gi, '('],
      [/\bopen parenthesis\b/gi, '('],
      [/\bclose paren\b/gi, ')'],
      [/\bclose parenthesis\b/gi, ')'],
      [/\bdash\b/gi, '-'],
      [/\bhyphen\b/gi, '-'],
      [/\bslash\b/gi, '/'],
      [/\bforward slash\b/gi, '/'],
      [/\bbackslash\b/gi, '\\'],
      [/\basterisk\b/gi, '*'],
      [/\bhash\b/gi, '#'],
      [/\bhashtag\b/gi, '#'],
      [/\bat sign\b/gi, '@'],
      [/\bampersand\b/gi, '&'],
      [/\bpercent\b/gi, '%'],
      [/\bdollar sign\b/gi, '$'],
      [/\beuro sign\b/gi, '€'],
      [/\bdouble quote\b/gi, '"'],
      [/\bsingle quote\b/gi, "'"],
    ];

    let result = text;
    for (const [regex, replacement] of rules) {
      result = result.replace(regex, replacement);
    }

    return this.cleanPunctuationSpaces(result);
  }

  private cleanPunctuationSpaces(text: string): string {
    return text
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\s+\?/g, '?')
      .replace(/\s+!/g, '!')
      .replace(/\s+:/g, ':')
      .replace(/\s+;/g, ';')
      .replace(/\s+\)/g, ')')
      .replace(/\(\s+/g, '(')
      .replace(/\s+-/g, '-')
      .replace(/\s+\//g, '/')
      .replace(/\s+@/g, '@')
      .replace(/\s+#/g, '#')
      .replace(/\s+&/g, '&')
      .replace(/\s+\*/g, '*')
      .replace(/\s+\\/g, '\\')
      .replace(/\s+\$/g, '$')
      .replace(/\s+%/g, '%')
      .replace(/\s+"/g, '"')
      .replace(/\s+'/g, "'")
      .replace(/\n\s+/g, '\n')
      .replace(/\s+(?=\n)/g, '')
      .replace(/\.\s*\./g, '.')
      .replace(/,\s*\./g, '.')
      .replace(/,\s+,/g, ',')
      .replace(/[^\S\n]{2,}/g, ' ');
  }
}

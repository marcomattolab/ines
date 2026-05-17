import { Component, inject, signal, computed } from '@angular/core';
import { TodoService } from '../../core/services/todo.service';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';

interface AiChat { id: number; role: 'user'|'ai'; text: string; typing?: boolean; }

const SYSTEM_TODO = `You are a productivity assistant for planning.
Your task is to generate a list of tasks for the day based on what the user describes.

Respond ONLY with a JSON object (nothing else, no markdown, no backticks) in this format:
{
  "tasks": [
    {"text": "Task description", "priority": "normal"},
    {"text": "Urgent task description", "priority": "priority"}
  ],
  "message": "Brief motivational message (1 sentence)"
}

Generate 4 to 8 concrete, specific and realistic tasks. "priority" can be "normal" or "priority".`;

@Component({
  selector: 'app-todo-tab',
  standalone: true,
  imports: [MessageBubbleComponent, TypingIndicatorComponent],
  templateUrl: './todo-tab.component.html',
  styleUrl: './todo-tab.css'
})
export class TodoTabComponent {
  todoSvc = inject(TodoService);
  llm     = inject(LlmService);
  toast   = inject(ToastService);

  aiMessages = signal<AiChat[]>([]);
  recording  = signal(false);
  timerText  = signal('');
  rightPanelWidth = signal(320);
  inputAreaHeight = signal(130);
  
  private nextId = 0;
  private recognition: any = null;
  private seconds = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private baseText = '';
  private isResizing = false;
  private isHResizing = false;

  startResize(e: MouseEvent) {
    this.isResizing = true;
    e.preventDefault();
    document.addEventListener('mousemove', this.doResize);
    document.addEventListener('mouseup', this.stopResize);
  }

  private doResize = (e: MouseEvent) => {
    if (!this.isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 280 && newWidth <= window.innerWidth - 300) {
      this.rightPanelWidth.set(newWidth);
    }
  };

  private stopResize = () => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.doResize);
    document.removeEventListener('mouseup', this.stopResize);
  };

  startHResize(e: MouseEvent) {
    this.isHResizing = true;
    e.preventDefault();
    document.addEventListener('mousemove', this.doHResize);
    document.addEventListener('mouseup', this.stopHResize);
  }

  private doHResize = (e: MouseEvent) => {
    if (!this.isHResizing) return;
    const newHeight = window.innerHeight - e.clientY - 28; // Subtracting footer height approx
    if (newHeight >= 100 && newHeight <= window.innerHeight - 200) {
      this.inputAreaHeight.set(newHeight);
    }
  };

  private stopHResize = () => {
    this.isHResizing = false;
    document.removeEventListener('mousemove', this.doHResize);
    document.removeEventListener('mouseup', this.stopHResize);
  };

  addManual(input: HTMLInputElement, selEl?: HTMLSelectElement) {
    const text = input.value.trim();
    if (!text) return;
    const priority = (selEl?.value ?? 'normal') as 'normal' | 'priority';
    this.todoSvc.add(text, priority);
    input.value = '';
  }

  onAiKey(e: KeyboardEvent, el: HTMLTextAreaElement) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.generate(el); }
  }

  toggleRecording(textarea: HTMLTextAreaElement) {
    this.recording() ? this.stopRecording() : this.startRecording(textarea);
  }

  startRecording(textarea: HTMLTextAreaElement) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { this.toast.show('⚠️ Web Speech API not supported in this browser'); return; }

    this.baseText = textarea.value.trim();
    if (this.baseText) this.baseText += ' ';

    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = navigator.language || 'en-US';

    this.recognition.onresult = (e: any) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      if (final) this.baseText += final;
      textarea.value = this.baseText + (interim ? `[${interim}]` : '');
    };

    this.recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') this.toast.show('⚠️ Mic error: ' + e.error);
    };

    this.recognition.onend = () => {
      if (this.recording()) this.recognition.start();
    };

    this.recognition.start();
    this.recording.set(true);
    this.seconds = 0;

    this.intervalId = setInterval(() => {
      this.seconds++;
      const m = Math.floor(this.seconds / 60).toString().padStart(2, '0');
      const s = (this.seconds % 60).toString().padStart(2, '0');
      this.timerText.set(`${m}:${s}`);
    }, 1000);
  }

  stopRecording() {
    if (this.recognition) { this.recognition.stop(); this.recognition = null; }
    this.recording.set(false);
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.timerText.set('');
  }

  ngOnDestroy() {
    this.stopRecording();
  }

  async generate(textarea: HTMLTextAreaElement) {
    if (this.recording()) this.stopRecording();
    
    const desc = textarea.value.trim();
    if (!desc) { this.toast.show('⚠️ Describe what you have to do today'); return; }
    if (!this.llm.isReady()) { this.toast.show('⚠️ Load the model first!'); return; }

    const userMsgId = this.nextId++;
    const typingId  = this.nextId++;
    this.aiMessages.update(m => [
      ...m,
      { id: userMsgId, role: 'user', text: desc },
      { id: typingId,  role: 'ai',   text: '',    typing: true },
    ]);
    textarea.value = '';
    this.baseText = '';

    const prompt = this.llm.buildPrompt(SYSTEM_TODO, `Today I have to do: ${desc}. Plan my day.`);

    try {
      let fullText = '';
      await this.llm.generate(prompt, (_, done, full) => {
        fullText = full;
        this.aiMessages.update(m => m.map(msg =>
          msg.id === typingId ? { ...msg, typing: false, text: done ? 'Parsing tasks...' : full.substring(0, 80) + '...' } : msg
        ));
      });

      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        this.todoSvc.addMany(data.tasks);
        this.aiMessages.update(m => m.map(msg =>
          msg.id === typingId
            ? { ...msg, text: `✅ Added ${data.tasks.length} tasks! ${data.message || ''}` }
            : msg
        ));
      } else {
        throw new Error('Invalid JSON in response');
      }
    } catch(e: any) {
      this.aiMessages.update(m => m.map(msg =>
        msg.id === typingId ? { ...msg, typing: false, text: '❌ ' + e.message } : msg
      ));
    }
  }
}

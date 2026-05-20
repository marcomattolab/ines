import { Component, inject, signal, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

const SYSTEM_EMAIL = `You are a professional in corporate communication and professional writing.
Your task is to edit emails according to the instructions.
Respond ONLY with the edited email text, without additional explanations or headers like "Here is your email:" etc.
Use the language of the original text.`;

@Component({
  selector: 'app-email-tab',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, ButtonComponent],
  templateUrl: './email-tab.component.html',
  styleUrl: './email-tab.css',
})
export class EmailTabComponent {
  readonly emailInputRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('emailInput');

  llm = inject(LlmService);
  toast = inject(ToastService);

  tone = 'professional';
  action = 'improve';
  result = signal('');
  processing = signal(false);

  resultHtml() {
    return this.result()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  async process() {
    const emailText = this.emailInputRef()?.nativeElement.value.trim();
    if (!emailText) {
      this.toast.show('⚠️ Insert the email text first');
      return;
    }
    if (!this.llm.isReady()) {
      this.toast.show('⚠️ Load the model first!');
      return;
    }

    const actionMap: Record<string, string> = {
      improve: `Improve this email while keeping the main message but making it more ${this.tone}.`,
      fix: `Fix all grammatical and spelling errors in this email.`,
      shorten: `Shorten this email to half its length while keeping the essential points, with a ${this.tone} tone.`,
      formal: `Make this email more formal and professional.`,
      reply: `Write an appropriate response to this email, with a ${this.tone} tone.`,
      summary: `Summarize the key points of this email in 3-5 bullet points.`,
    };

    const prompt = this.llm.buildPrompt(
      SYSTEM_EMAIL,
      `${actionMap[this.action]}\n\nEMAIL:\n${emailText}`,
    );
    this.processing.set(true);
    this.result.set(' ');

    try {
      await this.llm.generate(prompt, (_, _done, full) => this.result.set(full));
    } catch (e: any) {
      this.result.set('❌ ' + e.message);
    }
    this.processing.set(false);
  }

  copy() {
    navigator.clipboard.writeText(this.result()).then(() => this.toast.show('📋 Copied!'));
  }

  clear() {
    const emailInputRef = this.emailInputRef();
    if (emailInputRef) emailInputRef.nativeElement.value = '';
    this.result.set('');
  }
}

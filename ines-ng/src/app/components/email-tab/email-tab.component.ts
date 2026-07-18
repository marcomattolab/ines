import { Component, inject, signal, ElementRef, viewChild, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';

const SYSTEM_EMAIL = `You are a professional in corporate communication and professional writing.
Your task is to edit emails according to the instructions.
Respond ONLY with the edited email text, without additional explanations or headers like "Here is your email:" etc.
Use the language of the original text.`;

@Component({
  selector: 'app-email-tab',
  standalone: true,
  imports: [FormsModule, MatIconModule, ButtonComponent, DropdownComponent],
  templateUrl: './email-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class EmailTabComponent implements OnDestroy {
  readonly emailInputRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('emailInput');

  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  private readonly dom = inject(DomUtilsService);

  tone = signal('professional');
  action = signal('improve');
  result = signal('');
  processing = signal(false);
  selectedTemplate = signal('');

  readonly templates = [
    {
      value: 'reply',
      label: 'Reply to customer',
      text: 'Thank you for reaching out. I appreciate your patience and I am happy to help with your request.',
    },
    {
      value: 'followup',
      label: 'Follow-up meeting',
      text: 'Great meeting today! I wanted to follow up on our discussion and share the next steps we agreed upon.\n\nAction items:\n- \n- \n',
    },
    {
      value: 'cold',
      label: 'Cold outreach',
      text: 'Hi, I came across your work and was really impressed. I would love to connect and explore potential collaboration.',
    },
    {
      value: 'complaint',
      label: 'Handle complaint',
      text: 'I understand your frustration and I sincerely apologize for the inconvenience. Let me address your concerns immediately.',
    },
    {
      value: 'proposal',
      label: 'Business proposal',
      text: 'I am excited to present this proposal for our potential collaboration. Below you will find the scope, timeline, and investment details.\n\nScope:\n- \n\nTimeline:\n- \n\nInvestment:\n- ',
    },
  ];

  applyTemplate(tmpl: (typeof this.templates)[number]) {
    const el = this.emailInputRef()?.nativeElement;
    if (el) el.value = tmpl.text;
    this.selectedTemplate.set(tmpl.value);
  }

  readonly toneOptions = [
    { value: 'professional', label: 'Professional', icon: 'badge' },
    { value: 'friendly', label: 'Friendly', icon: 'sentiment_satisfied' },
    { value: 'assertive', label: 'Assertive', icon: 'flash_on' },
    { value: 'formal', label: 'Formal', icon: 'description' },
    { value: 'concise', label: 'Short and Concise', icon: 'short_text' },
  ];

  readonly actionOptions = [
    { value: 'improve', label: 'Improve', icon: 'auto_fix_high' },
    { value: 'fix', label: 'Fix grammar', icon: 'spellcheck' },
    { value: 'shorten', label: 'Shorten', icon: 'content_cut' },
    { value: 'formal', label: 'Formal', icon: 'badge' },
    { value: 'reply', label: 'Reply', icon: 'reply' },
    { value: 'summary', label: 'Summary', icon: 'summarize' },
  ];

  resultHtml() {
    return this.dom.escapeHtml(this.result());
  }

  async process() {
    const emailText = this.emailInputRef()?.nativeElement.value.trim();
    if (!emailText) {
      this.toast.show('Insert the email text first');
      return;
    }
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }

    const actionMap: Record<string, string> = {
      improve: `Improve this email while keeping the main message but making it more ${this.tone()}.`,
      fix: `Fix all grammatical and spelling errors in this email.`,
      shorten: `Shorten this email to half its length while keeping the essential points, with a ${this.tone()} tone.`,
      formal: `Make this email more formal and professional.`,
      reply: `Write an appropriate response to this email, with a ${this.tone()} tone.`,
      summary: `Summarize the key points of this email in 3-5 bullet points.`,
    };

    const prompt = this.llm.buildPrompt(
      SYSTEM_EMAIL,
      `${actionMap[this.action()]}\n\nEMAIL:\n${emailText}`,
    );
    this.processing.set(true);
    this.result.set(' ');

    try {
      await this.llm.generate(prompt, (_, _done, full) => this.result.set(full));
    } catch (e: any) {
      const msg = e.message?.includes('INVALID_ARGUMENT')
        ? 'Conversation too long. Try shorter text.'
        : e.message;
      this.result.set(msg);
    }
    this.processing.set(false);
  }

  onEmailKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.process();
    }
  }

  copy() {
    this.dom.copyToClipboard(this.result()).then(() => this.toast.success('Copied!'));
  }

  clear() {
    const emailInputRef = this.emailInputRef();
    if (emailInputRef) emailInputRef.nativeElement.value = '';
    this.result.set('');
  }

  ngOnDestroy() {
    // no-op: included for lifecycle completeness
  }
}

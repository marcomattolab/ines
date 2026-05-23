import { Component, inject, signal, ElementRef, viewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AgentService, Agent, Skill } from '../../core/services/agent.service';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { FormsModule } from '@angular/forms';

interface UiMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
}

@Component({
  selector: 'app-agents-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    ButtonComponent,
    MessageBubbleComponent,
    TypingIndicatorComponent,
    FormsModule
  ],
  templateUrl: './agents-tab.component.html',
  styleUrl: './agents-tab.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class AgentsTabComponent implements AfterViewChecked {
  agentSvc = inject(AgentService);
  llm = inject(LlmService);
  toast = inject(ToastService);

  selectedAgent = signal<Agent | null>(this.agentSvc.agents()[0] || null);
  activeMode = signal<'chat' | 'edit'>('chat');
  editingSkill = signal<Skill | null>(null);

  // Chat state
  messages = signal<UiMessage[]>([]);
  generating = signal(false);
  typing = signal(false);
  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;

  readonly chatArea = viewChild<ElementRef<HTMLDivElement>>('chatArea');
  readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      const el = this.chatArea()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  selectAgent(agent: Agent) {
    this.selectedAgent.set(agent);
    this.clearChat();
  }

  clearChat() {
    this.messages.set([]);
    this.history = [];
    this.nextId = 1;
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  autoResize(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  async send() {
    const agent = this.selectedAgent();
    if (!agent || this.generating()) return;

    const text = this.inputEl()?.nativeElement.value.trim();
    if (!text) return;

    if (!this.llm.isReady()) {
      this.toast.show('⚠️ Load the model first!');
      return;
    }

    this.generating.set(true);
    if (this.inputEl()) {
      this.inputEl()!.nativeElement.value = '';
      this.inputEl()!.nativeElement.style.height = '';
    }

    this.history.push({ role: 'user', content: text });
    this.messages.update(m => [...m, { id: this.nextId++, role: 'user', text }]);
    this.typing.set(true);
    this.shouldScroll = true;

    const systemPrompt = this.agentSvc.getAgentFullPrompt(agent);
    const trimmed = this.llm.trimConversation(systemPrompt, text, this.history.slice(-6, -1));
    const prompt = this.llm.buildPrompt(systemPrompt, text, trimmed);
    const aiId = this.nextId++;

    try {
      let full = '';
      await this.llm.generate(prompt, (_, done, fullText) => {
        full = fullText;
        if (this.typing()) {
          this.typing.set(false);
          this.messages.update(m => [...m, { id: aiId, role: 'ai', text: fullText, streaming: true }]);
        } else {
          this.messages.update(m => m.map(msg => msg.id === aiId ? { ...msg, text: fullText, streaming: !done } : msg));
        }
        this.shouldScroll = true;
      });
      this.history.push({ role: 'assistant', content: full });
    } catch (e: any) {
      this.typing.set(false);
      this.messages.update(m => [...m, { id: this.nextId++, role: 'ai', text: '❌ ' + e.message }]);
    }
    this.generating.set(false);
  }

  // Edit Mode Logic
  isSkillSelected(skillId: string): boolean {
    return this.selectedAgent()?.skillIds.includes(skillId) ?? false;
  }

  toggleSkill(skillId: string) {
    const agent = this.selectedAgent();
    if (!agent) return;

    const skillIds = agent.skillIds.includes(skillId)
      ? agent.skillIds.filter(id => id !== skillId)
      : [...agent.skillIds, skillId];

    const updated = { ...agent, skillIds };
    this.agentSvc.updateAgent(updated);
    this.selectedAgent.set(updated);
  }

  saveAgent(agent: Agent) {
    this.agentSvc.updateAgent(agent);
    this.toast.show('✅ Agent updated');
  }

  addNewAgent() {
    const newAgent = this.agentSvc.addAgent({
      name: 'New Agent',
      description: 'Description of the agent',
      systemPrompt: 'You are a helpful assistant.',
      skillIds: []
    });
    this.selectedAgent.set(newAgent);
    this.activeMode.set('edit');
  }

  deleteAgent(id: string) {
    if (confirm('Are you sure you want to delete this agent?')) {
      this.agentSvc.deleteAgent(id);
      this.selectedAgent.set(this.agentSvc.agents()[0] || null);
    }
  }

  // Skill Editor logic
  addNewSkill() {
    this.editingSkill.set({
      id: '',
      name: 'New Skill',
      description: 'Skill description',
      instructions: 'How the agent should behave with this skill.'
    });
  }

  editSkill(skill: Skill) {
    this.editingSkill.set({ ...skill });
  }

  saveSkill(skill: Skill) {
    if (skill.id) {
      this.agentSvc.updateSkill(skill);
    } else {
      this.agentSvc.addSkill(skill);
    }
    this.editingSkill.set(null);
    this.toast.show('✅ Skill saved');
  }

  cancelEditSkill() {
    this.editingSkill.set(null);
  }

  deleteSkill(id: string) {
    if (confirm('Are you sure you want to delete this skill? It will be removed from all agents.')) {
      this.agentSvc.deleteSkill(id);
      this.toast.show('🗑️ Skill deleted');
    }
  }

  html(text: string) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
}

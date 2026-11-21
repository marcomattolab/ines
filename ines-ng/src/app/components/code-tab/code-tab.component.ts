import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { CodingTabComponent } from '../coding-tab/coding-tab.component';
import { DevAgentTabComponent } from '../dev-agent-tab/dev-agent-tab.component';
import { AgentsTabComponent } from '../agents-tab/agents-tab.component';

type CodeTool = 'coding' | 'dev-agent' | 'agents';

interface CodeToolDef {
  id: CodeTool;
  icon: string;
  label: string;
  labelIt: string;
  color: string;
  hex: string;
}

@Component({
  selector: 'app-code-tab',
  standalone: true,
  imports: [MatIconModule, CodingTabComponent, DevAgentTabComponent, AgentsTabComponent],
  templateUrl: './code-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class CodeTabComponent {
  private readonly i18n = inject(I18nService);

  readonly tools: CodeToolDef[] = [
    {
      id: 'coding',
      icon: 'code',
      label: 'Code',
      labelIt: 'Codice',
      color: 'text-sky-400',
      hex: '#38bdf8',
    },
    {
      id: 'dev-agent',
      icon: 'smart_toy',
      label: 'DevAgent',
      labelIt: 'DevAgent',
      color: 'text-violet-400',
      hex: '#a78bfa',
    },
    {
      id: 'agents',
      icon: 'support_agent',
      label: 'Agents',
      labelIt: 'Agenti',
      color: 'text-emerald-400',
      hex: '#34d399',
    },
  ];

  readonly active = signal<CodeTool>('coding');

  toolLabel(t: CodeToolDef): string {
    return this.i18n.isIt() ? t.labelIt : t.label;
  }
}

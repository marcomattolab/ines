import { Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CodingTabComponent } from '../coding-tab/coding-tab.component';
import { DevAgentTabComponent } from '../dev-agent-tab/dev-agent-tab.component';
import { AgentsTabComponent } from '../agents-tab/agents-tab.component';

type CodeTool = 'coding' | 'dev-agent' | 'agents';

@Component({
  selector: 'app-code-tab',
  standalone: true,
  imports: [MatIconModule, CodingTabComponent, DevAgentTabComponent, AgentsTabComponent],
  templateUrl: './code-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class CodeTabComponent {
  readonly tools: { id: CodeTool; icon: string; label: string; color: string }[] = [
    { id: 'coding', icon: 'code', label: 'Code', color: 'text-sky-400' },
    { id: 'dev-agent', icon: 'smart_toy', label: 'DevAgent', color: 'text-violet-400' },
    { id: 'agents', icon: 'support_agent', label: 'Agents', color: 'text-emerald-400' },
  ];

  readonly active = signal<CodeTool>('coding');
}

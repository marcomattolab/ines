import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BrainTabComponent } from '../brain-tab/brain-tab.component';
import { ProjectTabComponent } from '../project-tab/project-tab.component';
import { I18nService } from '../../core/services/i18n.service';

type KnowledgeTool = 'brain' | 'project';
const ACTIVE_TOOL_KEY = 'ines_knowledge_tool';

interface KnowledgeToolDef {
  id: KnowledgeTool;
  icon: string;
  label: string;
  labelIt: string;
  color: string;
  hex: string;
}

@Component({
  selector: 'app-knowledge-tab',
  standalone: true,
  imports: [MatIconModule, BrainTabComponent, ProjectTabComponent],
  templateUrl: './knowledge-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class KnowledgeTabComponent {
  private readonly i18n = inject(I18nService);

  readonly tools: KnowledgeToolDef[] = [
    {
      id: 'brain',
      icon: 'psychology',
      label: 'Second Brain',
      labelIt: 'Second Brain',
      color: 'text-purple-400',
      hex: '#c084fc',
    },
    {
      id: 'project',
      icon: 'folder',
      label: 'Project',
      labelIt: 'Progetto',
      color: 'text-amber-400',
      hex: '#fbbf24',
    },
  ];

  readonly active = signal<KnowledgeTool>(this.restoreTool());

  toolLabel(t: KnowledgeToolDef): string {
    return this.i18n.isIt() ? t.labelIt : t.label;
  }

  setTool(id: KnowledgeTool): void {
    this.active.set(id);
    try {
      sessionStorage.setItem(ACTIVE_TOOL_KEY, id);
    } catch {
      /* best effort */
    }
  }

  private restoreTool(): KnowledgeTool {
    try {
      const v = sessionStorage.getItem(ACTIVE_TOOL_KEY);
      if (v === 'brain' || v === 'project') return v;
    } catch {
      /* best effort */
    }
    return 'brain';
  }
}

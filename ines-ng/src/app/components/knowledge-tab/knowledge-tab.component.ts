import { Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BrainTabComponent } from '../brain-tab/brain-tab.component';
import { ProjectTabComponent } from '../project-tab/project-tab.component';

type KnowledgeTool = 'brain' | 'project';

@Component({
  selector: 'app-knowledge-tab',
  standalone: true,
  imports: [MatIconModule, BrainTabComponent, ProjectTabComponent],
  templateUrl: './knowledge-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class KnowledgeTabComponent {
  readonly tools: { id: KnowledgeTool; icon: string; label: string; color: string; hex: string }[] =
    [
      {
        id: 'brain',
        icon: 'psychology',
        label: 'Second Brain',
        color: 'text-purple-400',
        hex: '#c084fc',
      },
      { id: 'project', icon: 'folder', label: 'Project', color: 'text-amber-400', hex: '#fbbf24' },
    ];

  readonly active = signal<KnowledgeTool>('brain');
}

import { Component, inject, output } from '@angular/core';
import { LlmService } from '../../core/services/llm.service';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.css'
})
export class StatusBarComponent {
  llm = inject(LlmService);
  openLoader = output<void>();
}

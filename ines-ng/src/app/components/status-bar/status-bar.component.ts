import { Component, inject, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { LlmService } from '../../core/services/llm.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [MatIcon, ButtonComponent],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.css'
})
export class StatusBarComponent {
  llm = inject(LlmService);
  openLoader = output<void>();
  openInfo = output<void>();
}

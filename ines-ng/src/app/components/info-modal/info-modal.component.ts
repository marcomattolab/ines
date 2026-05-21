import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-info-modal',
  standalone: true,
  imports: [MatIcon, ButtonComponent],
  templateUrl: './info-modal.component.html',
  styleUrl: './info-modal.css'
})
export class InfoModalComponent {
  visible = input<boolean>(false);
  closed = output<void>();

  close() {
    this.closed.emit();
  }
}

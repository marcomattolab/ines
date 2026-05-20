import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="cardClasses()">
      @if (title()) {
        <div class="px-6 py-4 border-b border-white/5">
          <h3 class="text-lg font-semibold text-text-0">{{ title() }}</h3>
        </div>
      }
      <div class="p-6">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class CardComponent {
  readonly title = input<string | undefined>(undefined);
  readonly className = input<string>('');

  readonly cardClasses = computed(() => {
    return `bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden ${this.className()}`;
  });
}

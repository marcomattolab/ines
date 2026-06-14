import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [class]="buttonClasses()"
      (click)="onClick.emit($event)"
    >
      <ng-content></ng-content>
    </button>
  `,
  styles: [],
})
export class ButtonComponent {
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly variant = input<'primary' | 'secondary' | 'danger' | 'ghost'>('primary');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly disabled = input<boolean>(false);
  readonly className = input<string>('');
  readonly onClick = output<MouseEvent>();

  readonly buttonClasses = computed(() => {
    const baseClasses =
      'inline-flex items-center justify-center gap-2 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg';

    const variantClasses = {
      primary: 'bg-accent-blue hover:brightness-110 text-white focus:ring-accent-blue',
      secondary:
        'bg-white/10 hover:bg-white/20 text-white border border-white/10 focus:ring-white/20',
      danger:
        'bg-accent-rose/10 hover:bg-accent-rose/20 text-accent-rose border border-accent-rose/30 focus:ring-accent-rose',
      ghost: 'bg-transparent hover:bg-white/5 text-[var(--text-1)] focus:ring-white/10',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return `${baseClasses} ${variantClasses[this.variant()]} ${sizeClasses[this.size()]} ${this.className()}`;
  });
}

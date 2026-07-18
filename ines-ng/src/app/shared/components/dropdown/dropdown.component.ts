import { Component, signal, model, input, HostListener, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './dropdown.component.html',
  host: { class: 'relative' },
})
export class DropdownComponent {
  readonly options = input.required<readonly DropdownOption[]>();
  readonly value = model.required<string>();
  readonly placeholder = input('');

  protected readonly open = signal(false);

  protected readonly selectedOption = computed<DropdownOption | undefined>(() =>
    this.options().find((o) => o.value === this.value()),
  );

  protected readonly displayLabel = computed(() => {
    const opt = this.selectedOption();
    return opt ? opt.label : this.placeholder() || '';
  });

  protected readonly displayIcon = computed(() => this.selectedOption()?.icon);

  @HostListener('document:click')
  onDocumentClick() {
    this.open.set(false);
  }

  protected toggle(event: MouseEvent) {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  protected select(opt: DropdownOption, event: MouseEvent) {
    event.stopPropagation();
    this.value.set(opt.value);
    this.open.set(false);
  }
}

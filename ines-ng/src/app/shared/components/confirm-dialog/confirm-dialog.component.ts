import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  host: {
    class:
      'fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4',
    '(click)': 'cancel.emit()',
  },
})
export class ConfirmDialogComponent {
  readonly title = input('Confirm');
  readonly message = input('Are you sure?');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly danger = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  onContentClick(event: MouseEvent) {
    event.stopPropagation();
  }
}

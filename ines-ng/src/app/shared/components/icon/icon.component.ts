import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <mat-icon 
      [fontIcon]="iconName" 
      [style.width.px]="sizeNumber"
      [style.height.px]="sizeNumber"
      [style.font-size.px]="sizeNumber"
      [style.color]="color"
      [class]="className">
    </mat-icon>
  `
})
export class IconComponent {
  @Input() name: string = 'home';
  @Input() size: number | string = 20;
  @Input() color: string = 'currentColor';
  @Input() strokeWidth: number = 2; // Not used in Material Icons, kept for compatibility
  @Input() className: string = '';

  // Map icon names from your original Lucide icons to Material icons
  get iconName(): string {
    const iconMap: Record<string, string> = {
      'house': 'home',
      'message-square': 'chat',
      'mail': 'email',
      'mic': 'mic',
      'languages': 'translate',
      'check-square': 'check_box',
      'code': 'code',
      'settings': 'settings',
      'loader-2': 'hourglass_empty',
      'alert-circle': 'error',
      'check-circle-2': 'check_circle',
      'send': 'send',
      'trash-2': 'delete',
      'copy': 'content_copy',
      'plus': 'add',
      'refresh-cw': 'refresh',
      'x': 'close'
    };
    
    return iconMap[this.name] || this.name;
  }

  get sizeNumber(): number {
    return typeof this.size === 'string' ? parseInt(this.size, 10) : this.size;
  }
}
import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, House, MessageSquare, Mail, Mic, Languages, CheckSquare, Code, Settings, Loader2, AlertCircle, CheckCircle2, Send, Trash2, Copy, Plus, RefreshCw, X } from 'lucide-angular';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <lucide-angular
      [name]="name"
      [size]="size"
      [color]="color"
      [strokeWidth]="strokeWidth"
      [class]="className"
    ></lucide-angular>
  `
})
export class IconComponent {
  @Input() name: string = 'house';
  @Input() size: number | string = 20;
  @Input() color: string = 'currentColor';
  @Input() strokeWidth: number = 2;
  @Input() className: string = '';
}

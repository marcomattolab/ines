import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { VisionTabComponent } from '../vision-tab/vision-tab.component';
import { VisionAssistTabComponent } from '../vision-assist-tab/vision-assist-tab.component';
import { PiiOcrTabComponent } from '../pii-ocr-tab/pii-ocr-tab.component';
import { SicilianGesturesTabComponent } from '../sicilian-gestures-tab/sicilian-gestures-tab.component';
import { PinchScrollTabComponent } from '../pinch-scroll-tab/pinch-scroll-tab.component';
import { HeadCursorTabComponent } from '../head-cursor-tab/head-cursor-tab.component';
import { BackgroundTabComponent } from '../background-tab/background-tab.component';
import { TicTacToeTabComponent } from '../tic-tac-toe-tab/tic-tac-toe-tab.component';

type LabTool =
  | 'vision'
  | 'assist'
  | 'ocr'
  | 'gestures'
  | 'pinch'
  | 'cursor'
  | 'background'
  | 'tris';

interface LabToolDef {
  id: LabTool;
  icon: string;
  label: string;
  labelIt: string;
  color: string;
  hex: string;
}

@Component({
  selector: 'app-labs-tab',
  standalone: true,
  imports: [
    MatIconModule,
    VisionTabComponent,
    VisionAssistTabComponent,
    PiiOcrTabComponent,
    SicilianGesturesTabComponent,
    PinchScrollTabComponent,
    HeadCursorTabComponent,
    BackgroundTabComponent,
    TicTacToeTabComponent,
  ],
  templateUrl: './labs-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class LabsTabComponent {
  private readonly i18n = inject(I18nService);

  readonly tools: LabToolDef[] = [
    {
      id: 'vision',
      icon: 'visibility',
      label: 'Vision',
      labelIt: 'Visione',
      color: 'text-sky-400',
      hex: '#38bdf8',
    },
    {
      id: 'assist',
      icon: 'remove_red_eye',
      label: 'Vision Assist',
      labelIt: 'Assistente Visivo',
      color: 'text-cyan-400',
      hex: '#22d3ee',
    },
    {
      id: 'ocr',
      icon: 'document_scanner',
      label: 'OCR & PII',
      labelIt: 'OCR & PII',
      color: 'text-amber-400',
      hex: '#fbbf24',
    },
    {
      id: 'gestures',
      icon: 'back_hand',
      label: 'Gestures',
      labelIt: 'Gesti',
      color: 'text-amber-300',
      hex: '#fcd34d',
    },
    {
      id: 'pinch',
      icon: 'touch_app',
      label: 'Pinch Scroll',
      labelIt: 'Pinch & Scorri',
      color: 'text-teal-400',
      hex: '#2dd4bf',
    },
    {
      id: 'cursor',
      icon: 'face',
      label: 'Head Cursor',
      labelIt: 'Cursore Testa',
      color: 'text-indigo-400',
      hex: '#818cf8',
    },
    {
      id: 'background',
      icon: 'wallpaper',
      label: 'Background',
      labelIt: 'Sfondo',
      color: 'text-lime-400',
      hex: '#a3e635',
    },
    {
      id: 'tris',
      icon: 'grid_on',
      label: 'Tris',
      labelIt: 'Tris',
      color: 'text-rose-400',
      hex: '#fb7185',
    },
  ];

  readonly active = signal<LabTool>('vision');

  toolLabel(t: LabToolDef): string {
    return this.i18n.isIt() ? t.labelIt : t.label;
  }
}

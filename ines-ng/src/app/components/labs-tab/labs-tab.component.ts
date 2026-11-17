import { Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
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
  readonly tools: { id: LabTool; icon: string; label: string; color: string; hex: string }[] = [
    { id: 'vision', icon: 'visibility', label: 'Vision', color: 'text-sky-400', hex: '#38bdf8' },
    {
      id: 'assist',
      icon: 'remove_red_eye',
      label: 'Vision Assist',
      color: 'text-cyan-400',
      hex: '#22d3ee',
    },
    {
      id: 'ocr',
      icon: 'document_scanner',
      label: 'OCR & PII',
      color: 'text-amber-400',
      hex: '#fbbf24',
    },
    {
      id: 'gestures',
      icon: 'back_hand',
      label: 'Gestures',
      color: 'text-amber-300',
      hex: '#fcd34d',
    },
    {
      id: 'pinch',
      icon: 'touch_app',
      label: 'Pinch Scroll',
      color: 'text-teal-400',
      hex: '#2dd4bf',
    },
    { id: 'cursor', icon: 'face', label: 'Head Cursor', color: 'text-indigo-400', hex: '#818cf8' },
    {
      id: 'background',
      icon: 'wallpaper',
      label: 'Background',
      color: 'text-lime-400',
      hex: '#a3e635',
    },
    { id: 'tris', icon: 'grid_on', label: 'Tris', color: 'text-rose-400', hex: '#fb7185' },
  ];

  readonly active = signal<LabTool>('vision');
}

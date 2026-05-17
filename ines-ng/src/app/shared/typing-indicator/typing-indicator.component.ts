import { Component } from '@angular/core';

@Component({
  selector: 'app-typing-indicator',
  standalone: true,
  template: `
    <div class="typing-indicator">
      <span></span><span></span><span></span>
    </div>
  `,
  styles: [`
    .typing-indicator { display:flex; gap:5px; align-items:center; padding:4px 0; }
    .typing-indicator span {
      width:7px; height:7px; border-radius:50%;
      background: var(--accent-blue);
      animation: typing 1.2s ease-in-out infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay:.2s; }
    .typing-indicator span:nth-child(3) { animation-delay:.4s; }
    @keyframes typing {
      0%,60%,100% { transform:translateY(0); opacity:.4; }
      30% { transform:translateY(-5px); opacity:1; }
    }
  `]
})
export class TypingIndicatorComponent {}

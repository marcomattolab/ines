import { Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CertificationCatalogService } from '../../core/services/certification-catalog.service';
import { CertificationSoundService } from '../../core/services/certification-sound.service';

@Component({
  selector: 'app-cert-home-screen',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './cert-home-screen.component.html',
  styleUrls: ['./cert-shared.css', './cert-home-screen.component.css'],
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class CertHomeScreenComponent {
  protected readonly catalog = inject(CertificationCatalogService);
  protected readonly sound = inject(CertificationSoundService);

  readonly back = output<void>();
  readonly startPractice = output<'all' | 'wrong'>();
  readonly startExamSetup = output<void>();

  onPracticeClick(): void {
    this.sound.playIntro();
    this.startPractice.emit('all');
  }

  onPracticeWrongClick(): void {
    this.sound.playIntro();
    this.startPractice.emit('wrong');
  }

  onExamClick(): void {
    this.startExamSetup.emit();
  }

  onResetProgress(): void {
    if (confirm('Are you sure you want to reset all progress and history for this course?')) {
      this.catalog.resetProgress();
    }
  }
}

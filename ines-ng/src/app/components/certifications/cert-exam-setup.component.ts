import { Component, inject, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CertificationCatalogService } from '../../core/services/certification-catalog.service';
import { ExamConfig } from '../../core/models/certification.model';

@Component({
  selector: 'app-cert-exam-setup',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './cert-exam-setup.component.html',
  styleUrls: ['./cert-shared.css', './cert-exam-setup.component.css'],
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class CertExamSetupComponent {
  protected readonly catalog = inject(CertificationCatalogService);

  readonly back = output<void>();
  readonly start = output<ExamConfig>();

  readonly numQuestions = signal<number>(65);
  readonly passThreshold = signal<number>(70);

  constructor() {
    const applyDefaults = () => {
      const course = this.catalog.activeCourse();
      if (course) {
        this.numQuestions.set(course.numQuestions ?? 65);
        this.passThreshold.set(course.passThreshold ?? 70);
      }
    };
    applyDefaults();

    // Keep in sync if the component is created before the catalog has loaded.
    effect(applyDefaults, { allowSignalWrites: true });
  }

  onStart(): void {
    this.start.emit({
      numQuestions: this.numQuestions(),
      passThreshold: this.passThreshold(),
    });
  }
}

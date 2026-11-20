import { Component, inject, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CertificationCatalogService } from '../../core/services/certification-catalog.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { ToastService } from '../../core/services/toast.service';

const COURSE_ENTRY_TEMPLATE = `{
  "id": "my-course",
  "name": "My Course",
  "description": "Short description of what this certification covers.",
  "fileName": "certifications/my-course.json",
  "badge": "My Cert",
  "subtitle": "EXAM-101",
  "accent": "#4ade80",
  "examTitle": "My Course Certification",
  "examInfo": "Passing score: 70%. Select the best answer for each question.",
  "numQuestions": 20,
  "passThreshold": 70,
  "totalQuestions": 20
}`;

const QUESTION_BANK_TEMPLATE = `[
  {
    "url": "https://example.com/my-course/question-1",
    "question_no": "My Course topic 1 question 1",
    "question": "Which statement best describes the topic?",
    "options": {
      "A": "First option",
      "B": "Second option",
      "C": "Third option",
      "D": "Fourth option"
    },
    "images": [],
    "is_hotspot": false,
    "discussion": [
      "Selected Answer: A Explanation of why A is correct.",
      "Selected Answer: A Additional community explanation."
    ],
    "vote_counts": { "A": 80, "B": 10, "C": 5, "D": 5 },
    "most_voted": "A",
    "community_answer": "A",
    "correct_answer": "A"
  }
]`;

@Component({
  selector: 'app-cert-catalog-screen',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './cert-catalog-screen.component.html',
  styleUrls: ['./cert-shared.css', './cert-catalog-screen.component.css'],
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class CertCatalogScreenComponent {
  protected readonly catalog = inject(CertificationCatalogService);
  private readonly dom = inject(DomUtilsService);
  private readonly toast = inject(ToastService);

  readonly select = output<string>();
  readonly showConfigGuide = signal(false);

  readonly courseEntryTemplate = COURSE_ENTRY_TEMPLATE;
  readonly questionTemplate = QUESTION_BANK_TEMPLATE;

  async copyCourseEntry(): Promise<void> {
    await this.copyTemplate(COURSE_ENTRY_TEMPLATE, 'Course entry copied');
  }

  async copyQuestionTemplate(): Promise<void> {
    await this.copyTemplate(QUESTION_BANK_TEMPLATE, 'Question template copied');
  }

  downloadCourseEntry(): void {
    this.dom.downloadText(COURSE_ENTRY_TEMPLATE, 'courses-entry.json', 'application/json');
    this.toast.success('Template downloaded');
  }

  downloadQuestionTemplate(): void {
    this.dom.downloadText(QUESTION_BANK_TEMPLATE, 'my-course-questions.json', 'application/json');
    this.toast.success('Template downloaded');
  }

  private async copyTemplate(text: string, message: string): Promise<void> {
    try {
      await this.dom.copyToClipboard(text);
      this.toast.success(message);
    } catch {
      this.toast.error('Clipboard unavailable — select and copy the text manually.');
    }
  }
}

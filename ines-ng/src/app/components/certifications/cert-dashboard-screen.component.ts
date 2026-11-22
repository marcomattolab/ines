import { Component, inject, output, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CertificationCatalogService } from '../../core/services/certification-catalog.service';
import { CertificationProgressService } from '../../core/services/certification-progress.service';

interface TopicStat {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
}

interface ChartBar {
  score: number;
  passed: boolean;
  dateLabel: string;
}

@Component({
  selector: 'app-cert-dashboard-screen',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './cert-dashboard-screen.component.html',
  styleUrls: ['./cert-shared.css', './cert-dashboard-screen.component.css'],
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class CertDashboardScreenComponent {
  protected readonly catalog = inject(CertificationCatalogService);
  protected readonly progress = inject(CertificationProgressService);

  readonly back = output<void>();

  readonly recentSessions = computed<ChartBar[]>(() => {
    const exams = this.progress.examSessions();
    const last = exams.slice(-10);
    return last.map((s) => ({
      score: s.scorePercentage,
      passed: s.passed,
      dateLabel: this.shortDate(s.timestamp),
    }));
  });

  readonly topicStats = computed<TopicStat[]>(() => {
    const questions = this.catalog.questions();
    const history = this.catalog.answerHistory();

    const byTopic = new Map<string, { correct: number; total: number }>();
    for (const q of questions) {
      const key = q.url || q.question_no;
      const item = history[key];
      if (!item) continue;

      const topic = this.topicFromUrl(q.url);
      const stat = byTopic.get(topic) ?? { correct: 0, total: 0 };
      stat.total++;
      if (item.isCorrect) stat.correct++;
      byTopic.set(topic, stat);
    }

    return Array.from(byTopic.entries())
      .map(([topic, stat]) => ({
        topic,
        correct: stat.correct,
        total: stat.total,
        accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
      .slice(0, 8);
  });

  private shortDate(timestamp: number): string {
    const d = new Date(timestamp);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Derive a readable topic label from an angular.dev (or generic) URL. */
  private topicFromUrl(url: string): string {
    try {
      const segments = url
        .replace(/^https?:\/\//, '')
        .split('/')
        .map((s) => decodeURIComponent(s))
        .filter((s) => s.length > 0);

      const guideIdx = segments.indexOf('guide');
      if (guideIdx >= 0 && segments[guideIdx + 1]) {
        return this.humanize(segments[guideIdx + 1]);
      }
      const apiIdx = segments.indexOf('api');
      if (apiIdx >= 0 && segments[apiIdx + 1]) {
        return this.humanize(segments[apiIdx + 1]);
      }
      return this.humanize(segments[segments.length - 1] || 'general');
    } catch {
      return 'general';
    }
  }

  private humanize(segment: string): string {
    return segment
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
}

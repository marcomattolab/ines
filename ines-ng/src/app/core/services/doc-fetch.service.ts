import { Injectable, signal, inject } from '@angular/core';
import { KnowledgeManagerService } from './knowledge-manager.service';
import { ToastService } from './toast.service';

interface DocSource {
  name: string;
  url: string;
}

const ANGULAR_DOCS: DocSource[] = [
  // Signals
  {
    name: 'angular-signals.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/signals/signals.md',
  },
  {
    name: 'angular-input-output.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/signals/inputs-outputs.md',
  },
  {
    name: 'angular-model.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/signals/model.md',
  },
  {
    name: 'angular-queries.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/signals/queries.md',
  },
  // Components
  {
    name: 'angular-components.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/components/basics.md',
  },
  {
    name: 'angular-lifecycle.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/components/lifecycle.md',
  },
  {
    name: 'angular-host-elements.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/components/host-elements.md',
  },
  // Templates
  {
    name: 'angular-template-syntax.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/templates/template-syntax.md',
  },
  {
    name: 'angular-control-flow.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/templates/control-flow.md',
  },
  {
    name: 'angular-pipes.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/templates/pipes.md',
  },
  {
    name: 'angular-defer.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/templates/defer.md',
  },
  // DI
  {
    name: 'angular-di.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/di/dependency-injection.md',
  },
  {
    name: 'angular-inject-based-di.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/di/inject-based-di.md',
  },
  {
    name: 'angular-hierarchical-di.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/di/hierarchical-dependency-injection.md',
  },
  // Routing
  {
    name: 'angular-routing.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/routing/basics.md',
  },
  {
    name: 'angular-router-reference.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/routing/router-reference.md',
  },
  // Forms
  {
    name: 'angular-reactive-forms.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/forms/reactive-forms.md',
  },
  {
    name: 'angular-template-driven-forms.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/forms/template-driven-forms.md',
  },
  {
    name: 'angular-form-validation.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/forms/form-validation.md',
  },
  // HTTP
  {
    name: 'angular-http.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/http/http-client.md',
  },
  {
    name: 'angular-http-interceptors.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/http/interceptors.md',
  },
  // Other guides
  {
    name: 'angular-directives.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/directives/directives.md',
  },
  {
    name: 'angular-testing.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/testing/basics.md',
  },
  {
    name: 'angular-zoneless.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/zoneless.md',
  },
  {
    name: 'angular-tailwind.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/guide/tailwind.md',
  },
  // Best practices
  {
    name: 'angular-style-guide.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/best-practices/style-guide.md',
  },
  {
    name: 'angular-security.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/best-practices/security.md',
  },
  {
    name: 'angular-a11y.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/best-practices/accessibility.md',
  },
  // CLI
  {
    name: 'angular-cli-reference.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/reference/cli.md',
  },
  {
    name: 'angular-versions.md',
    url: 'https://raw.githubusercontent.com/angular/angular/main/adev/src/content/reference/versions.md',
  },
];

@Injectable({ providedIn: 'root' })
export class DocFetchService {
  readonly isFetching = signal(false);
  readonly fetchProgress = signal('');
  readonly docsLoaded = signal(false);
  private readonly fetchedUrls = new Set<string>();

  private readonly km = inject(KnowledgeManagerService);
  private readonly toast = inject(ToastService);

  async fetchAngularDocs(): Promise<{ added: number; skipped: number; failed: number }> {
    this.isFetching.set(true);
    this.fetchProgress.set('Starting Angular docs import...');

    let added = 0;
    let skipped = 0;
    let failed = 0;
    const total = ANGULAR_DOCS.length;

    for (let i = 0; i < ANGULAR_DOCS.length; i++) {
      const doc = ANGULAR_DOCS[i];
      this.fetchProgress.set(`Fetching ${i + 1}/${total}: ${doc.name}...`);

      if (this.fetchedUrls.has(doc.url)) {
        skipped++;
        continue;
      }

      try {
        const response = await fetch(doc.url);
        if (!response.ok) {
          console.warn(`Failed to fetch ${doc.url} (${response.status})`);
          failed++;
          continue;
        }

        const text = await response.text();
        if (!text.trim()) {
          failed++;
          continue;
        }

        const file = new File([text], doc.name, { type: 'text/plain' });
        await this.km.processFile(file);
        this.fetchedUrls.add(doc.url);
        added++;
      } catch (err) {
        console.warn(`Error fetching ${doc.name}:`, err);
        failed++;
      }
    }

    this.isFetching.set(false);
    this.fetchProgress.set('');

    if (added > 0) {
      this.docsLoaded.set(true);
      this.toast.success(
        `Angular docs imported: ${added} added${skipped > 0 ? `, ${skipped} skipped` : ''}${failed > 0 ? `, ${failed} failed` : ''}`,
      );
    } else if (failed > 0) {
      this.toast.error(`Failed to fetch ${failed} Angular doc(s). Check your connection.`);
    }

    return { added, skipped, failed };
  }
}

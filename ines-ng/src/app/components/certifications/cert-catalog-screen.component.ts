import { Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CertificationCatalogService } from '../../core/services/certification-catalog.service';

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

  readonly select = output<string>();
}

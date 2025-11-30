import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LoadingOverlayComponent } from '../loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, LoadingOverlayComponent],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
})
/** Contenedor de tabla estilizada que integra un overlay de carga reutilizable. */
export class DataTableComponent {
  @Input()
  loading = false;

  @Input()
  minHeight = 260;

  @Input()
  responsive = true;

  @Input()
  tableClass = 'table table-hover align-middle mb-0';

  @Input()
  showHeader = true;

  @Input()
  loadingLabel = 'Cargando datos...';
}

import { CommonModule, NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './loading-overlay.component.html',
  styleUrl: './loading-overlay.component.css',
})
/** Capa visual para bloquear la UI mientras se completan operaciones asíncronas. */
export class LoadingOverlayComponent {
  @Input()
  label = 'Cargando...';

  @Input()
  spinnerClass = 'text-primary';
}

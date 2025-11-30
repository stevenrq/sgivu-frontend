import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { LoadingOverlayComponent } from '../loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-form-shell',
  standalone: true,
  imports: [NgClass, LoadingOverlayComponent],
  templateUrl: './form-shell.component.html',
  styleUrl: './form-shell.component.css',
})
/** Contenedor base para formularios con encabezado y estados de carga configurables. */
export class FormShellComponent {
  @Input()
  title = '';

  @Input()
  subtitle = '';

  @Input()
  icon = '';

  @Input()
  loading = false;

  @Input()
  pageClass = '';

  @Input()
  cardClass = '';

  @Input()
  headerClass = '';

  @Input()
  footerClass = '';

  @Input()
  titleClass = '';

  @Input()
  subtitleClass = '';

  @Input()
  bodyClass = '';
}

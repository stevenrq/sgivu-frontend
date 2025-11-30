import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
})
/** Encabezado reutilizable para páginas con título, subtítulo y eyebrow opcional. */
export class PageHeaderComponent {
  @Input({ required: true })
  title!: string;

  @Input()
  subtitle?: string;

  @Input()
  eyebrow?: string;
}

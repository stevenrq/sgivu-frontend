import { CommonModule, NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';

type KpiVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'dark';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.css',
})
export class KpiCardComponent {
  @Input({ required: true })
  label!: string;

  @Input()
  value: string | number | null = null;

  @Input()
  description?: string;

  @Input()
  icon = 'bi-info-circle';

  @Input()
  variant: KpiVariant = 'primary';
}

import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-report-date-filter',
  imports: [FormsModule],
  templateUrl: './report-date-filter.component.html',
  styleUrls: ['./report-date-filter.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportDateFilterComponent {
  readonly dateRangeChange = output<{
    startDate: string | null;
    endDate: string | null;
  }>();

  startDate = signal<string | null>(null);
  endDate = signal<string | null>(null);

  applyFilter(): void {
    this.dateRangeChange.emit({
      startDate: this.startDate() || null,
      endDate: this.endDate() || null,
    });
  }

  clearFilter(): void {
    this.startDate.set(null);
    this.endDate.set(null);
    this.dateRangeChange.emit({ startDate: null, endDate: null });
  }
}

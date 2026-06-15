import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import {
  ExportFormat,
  PurchaseSaleReportService,
} from '../../../purchase-sales/services/purchase-sale-report.service';

@Component({
  selector: 'app-report-export-bar',
  templateUrl: './report-export-bar.component.html',
  styleUrls: ['./report-export-bar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportExportBarComponent {
  private readonly reportService = inject(PurchaseSaleReportService);
  private readonly destroyRef = inject(DestroyRef);

  readonly startDate = input<string | null>(null);
  readonly endDate = input<string | null>(null);

  readonly exportLoading = this.reportService.exportLoading;

  downloadReport(format: ExportFormat): void {
    this.reportService.download(
      format,
      this.destroyRef,
      this.startDate(),
      this.endDate(),
    );
  }
}

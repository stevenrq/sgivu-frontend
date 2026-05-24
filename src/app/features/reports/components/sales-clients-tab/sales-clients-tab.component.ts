import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { ContractType } from '../../../purchase-sales/models/contract-type.enum';
import { ContractStatus } from '../../../purchase-sales/models/contract-status.enum';
import {
  aggregateByUser,
  aggregateClientDistribution,
  aggregateTopClients,
  aggregateCanceledTrend,
} from '../../utils/report-aggregation.utils';
import {
  buildPerformanceByUserChart,
  buildClientDistributionChart,
  buildCanceledTrendChart,
  PERFORMANCE_BAR_OPTIONS,
  REPORT_DOUGHNUT_OPTIONS,
  REPORT_LINE_OPTIONS,
} from '../../utils/report-chart.utils';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-sales-clients-tab',
  imports: [
    BaseChartDirective,
    KpiCardComponent,
    CopCurrencyPipe,
    DataTableComponent,
  ],
  templateUrl: './sales-clients-tab.component.html',
  styleUrls: ['./sales-clients-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesClientsTabComponent {
  readonly contracts = input.required<PurchaseSale[]>();
  readonly isLoading = input(false);

  readonly performanceOptions: ChartOptions<'bar'> = PERFORMANCE_BAR_OPTIONS;
  readonly doughnutOptions: ChartOptions<'doughnut'> = REPORT_DOUGHNUT_OPTIONS;
  readonly lineOptions: ChartOptions<'line'> = REPORT_LINE_OPTIONS;

  readonly totalSales = computed(
    () =>
      this.contracts().filter((c) => c.contractType === ContractType.SALE)
        .length,
  );

  readonly totalCanceled = computed(
    () =>
      this.contracts().filter(
        (c) => c.contractStatus === ContractStatus.CANCELED,
      ).length,
  );

  readonly userPerformance = computed(() => aggregateByUser(this.contracts()));

  readonly performanceChartData = computed(() =>
    buildPerformanceByUserChart(this.userPerformance()),
  );

  readonly clientDistribution = computed(() =>
    aggregateClientDistribution(this.contracts()),
  );

  readonly clientDistributionData = computed(() =>
    buildClientDistributionChart(this.clientDistribution()),
  );

  readonly topClients = computed(() => aggregateTopClients(this.contracts()));

  readonly canceledTrendData = computed(() => {
    const agg = aggregateCanceledTrend(this.contracts());
    return buildCanceledTrendChart(agg);
  });
}

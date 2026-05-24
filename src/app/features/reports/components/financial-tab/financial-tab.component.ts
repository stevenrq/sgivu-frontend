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
import { formatCopCurrency } from '../../../../shared/utils/currency.utils';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { ContractType } from '../../../purchase-sales/models/contract-type.enum';
import {
  aggregateRevenueVsExpenses,
  computeProfitMargins,
  aggregateRevenueByBrand,
} from '../../utils/report-aggregation.utils';
import {
  buildRevenueVsExpensesChart,
  buildRevenueByBrandChart,
  REVENUE_CHART_OPTIONS,
  HORIZONTAL_BAR_OPTIONS,
} from '../../utils/report-chart.utils';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-financial-tab',
  imports: [
    BaseChartDirective,
    KpiCardComponent,
    CopCurrencyPipe,
    DataTableComponent,
  ],
  templateUrl: './financial-tab.component.html',
  styleUrls: ['./financial-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialTabComponent {
  readonly contracts = input.required<PurchaseSale[]>();
  readonly isLoading = input(false);

  readonly revenueChartOptions: ChartOptions<'bar'> = REVENUE_CHART_OPTIONS;
  readonly brandChartOptions: ChartOptions<'bar'> = HORIZONTAL_BAR_OPTIONS;

  readonly totalRevenue = computed(() =>
    this.contracts()
      .filter((c) => c.contractType === ContractType.SALE)
      .reduce((sum, c) => sum + (c.salePrice ?? 0), 0),
  );

  readonly totalExpenses = computed(() =>
    this.contracts()
      .filter((c) => c.contractType === ContractType.PURCHASE)
      .reduce((sum, c) => sum + (c.purchasePrice ?? 0), 0),
  );

  readonly netProfit = computed(
    () => this.totalRevenue() - this.totalExpenses(),
  );

  readonly avgMarginPct = computed(() => {
    const margins = this.profitMargins();
    if (margins.length === 0) return 0;
    const totalPct = margins.reduce((sum, m) => sum + m.marginPct, 0);
    return Math.round((totalPct / margins.length) * 10) / 10;
  });

  readonly revenueVsExpensesData = computed(() => {
    const agg = aggregateRevenueVsExpenses(this.contracts());
    return buildRevenueVsExpensesChart(agg);
  });

  readonly revenueByBrandData = computed(() => {
    const agg = aggregateRevenueByBrand(this.contracts());
    return buildRevenueByBrandChart(agg);
  });

  readonly profitMargins = computed(() =>
    computeProfitMargins(this.contracts()),
  );

  formatCurrency(value: number): string {
    return formatCopCurrency(value);
  }
}

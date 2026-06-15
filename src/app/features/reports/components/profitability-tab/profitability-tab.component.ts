import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { formatCopCurrency } from '../../../../shared/utils/currency.utils';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import {
  computeInventoryValue,
  computeSaleVelocity,
} from '../../utils/report-aggregation.utils';
import {
  buildSaleVelocityChart,
  VELOCITY_BAR_OPTIONS,
} from '../../utils/report-chart.utils';

@Component({
  selector: 'app-profitability-tab',
  imports: [BaseChartDirective],
  templateUrl: './profitability-tab.component.html',
  styleUrls: ['./profitability-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfitabilityTabComponent {
  readonly contracts = input.required<PurchaseSale[]>();
  readonly isLoading = input(false);

  readonly velocityOptions: ChartOptions<'bar'> = VELOCITY_BAR_OPTIONS;

  readonly inventoryValue = computed(() =>
    computeInventoryValue(this.contracts()),
  );

  readonly saleVelocity = computed(() => computeSaleVelocity(this.contracts()));

  readonly velocityChartData = computed(() =>
    buildSaleVelocityChart(this.saleVelocity()),
  );

  formatCurrency(value: number): string {
    return formatCopCurrency(value);
  }
}

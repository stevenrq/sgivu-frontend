import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { Car } from '../../../vehicles/models/car.model';
import { Motorcycle } from '../../../vehicles/models/motorcycle.model';
import {
  computeInventoryAging,
  computeInventoryTurnover,
  aggregateVehicleComposition,
} from '../../utils/report-aggregation.utils';
import {
  buildInventoryAgingChart,
  buildTurnoverTrendChart,
  buildCompositionDoughnut,
  REPORT_LINE_OPTIONS,
  REPORT_DOUGHNUT_OPTIONS,
} from '../../utils/report-chart.utils';
import { MONTHLY_SALES_CHART_OPTIONS } from '../../../dashboard/utils/dashboard-chart.utils';

@Component({
  selector: 'app-inventory-tab',
  imports: [BaseChartDirective, KpiCardComponent],
  templateUrl: './inventory-tab.component.html',
  styleUrls: ['./inventory-tab.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryTabComponent {
  readonly contracts = input.required<PurchaseSale[]>();
  readonly cars = input.required<Car[]>();
  readonly motorcycles = input.required<Motorcycle[]>();
  readonly isLoading = input(false);

  readonly agingChartOptions: ChartOptions<'bar'> = MONTHLY_SALES_CHART_OPTIONS;
  readonly turnoverChartOptions: ChartOptions<'line'> = REPORT_LINE_OPTIONS;
  readonly doughnutOptions: ChartOptions<'doughnut'> = REPORT_DOUGHNUT_OPTIONS;

  readonly agingData = computed(() => {
    const buckets = computeInventoryAging(this.contracts());
    return buildInventoryAgingChart(buckets);
  });

  readonly turnoverResult = computed(() =>
    computeInventoryTurnover(this.contracts()),
  );

  readonly turnoverChartData = computed(() =>
    buildTurnoverTrendChart(this.turnoverResult()),
  );

  readonly composition = computed(() =>
    aggregateVehicleComposition(this.cars(), this.motorcycles()),
  );

  readonly bodyTypeData = computed(() =>
    buildCompositionDoughnut(this.composition().byBodyType),
  );
  readonly fuelTypeData = computed(() =>
    buildCompositionDoughnut(this.composition().byFuelType),
  );
  readonly motoTypeData = computed(() =>
    buildCompositionDoughnut(this.composition().byMotorcycleType),
  );
}

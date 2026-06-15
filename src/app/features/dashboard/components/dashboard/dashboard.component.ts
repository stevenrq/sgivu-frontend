import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin, retry, timer } from 'rxjs';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { DemandPredictionPanelComponent } from '../demand-prediction-panel/demand-prediction-panel.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { SkeletonLoaderComponent } from '../../../../shared/components/skeleton/skeleton-loader.component';
import { PurchaseSaleService } from '../../../purchase-sales/services/purchase-sale.service';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { DashboardSummary } from '../../models/dashboard-summary.model';
import {
  INVENTORY_CHART_OPTIONS,
  MONTHLY_SALES_CHART_OPTIONS,
  STATUS_FUNNEL_CHART_OPTIONS,
  buildInventoryChartData,
  buildMonthlySalesTrendData,
  SalesTrendMode,
  buildContractStatusFunnelData,
  buildPaymentMethodDistributionData,
} from '../../utils/dashboard-chart.utils';
import {
  RecentActivity,
  buildRecentActivity,
} from '../../utils/dashboard-activity.utils';
import {
  DashboardAlert,
  buildDashboardAlerts,
} from '../../utils/dashboard-alerts.utils';
import {
  computeSalesMetrics,
  formatDashboardCurrency,
} from '../../utils/dashboard-kpi.utils';

/**
 * Panel principal del sistema. Muestra KPIs del inventario (vehículos disponibles, vendidos,
 * en mantenimiento) y el módulo de predicciones de demanda ML.
 * Restaura el último estado de predicción entre navegaciones usando `DashboardStateService`.
 *
 * @see {@link DashboardStateService} para persistencia del estado entre navegaciones.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    BaseChartDirective,
    KpiCardComponent,
    DataTableComponent,
    SkeletonLoaderComponent,
    DemandPredictionPanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly purchaseSaleService = inject(PurchaseSaleService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly allContracts = signal<PurchaseSale[]>([]);

  readonly totalInventory = signal<number | null>(null);
  readonly monthlySales = signal<number | null>(null);
  private readonly monthlyRevenue = signal<number | null>(null);
  readonly vehiclesToSell = signal<number | null>(null);
  readonly salesHistoryCount = signal(0);

  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly inventoryData = signal<
    ChartConfiguration<'doughnut'>['data'] | null
  >(null);
  readonly inventoryOptions = INVENTORY_CHART_OPTIONS;

  readonly recentActivity = signal<RecentActivity[]>([]);
  readonly dashboardAlerts = signal<DashboardAlert[]>([]);
  readonly salesTrendMode = signal<SalesTrendMode>('completed');
  readonly monthlySalesTrend = computed<
    ChartConfiguration<'bar'>['data'] | null
  >(() => {
    const contracts = this.allContracts();
    if (contracts.length === 0) {
      return null;
    }

    return buildMonthlySalesTrendData(
      contracts,
      undefined,
      this.salesTrendMode(),
    );
  });
  readonly monthlySalesTrendTitle = computed(() =>
    this.salesTrendMode() === 'completed'
      ? 'Ventas Cerradas Mensuales'
      : 'Tendencia de Ventas Mensuales',
  );
  readonly monthlySalesTrendPeriodTotal = computed(() => {
    const series = this.monthlySalesTrend()?.datasets?.[0]?.data;
    if (!series) {
      return 0;
    }

    let total = 0;
    for (const value of series) {
      if (typeof value === 'number') {
        total += value;
        continue;
      }

      if (Array.isArray(value) && value.length > 1) {
        total += Number(value[1] ?? 0);
      }
    }

    return total;
  });
  readonly contractStatusData = signal<
    ChartConfiguration<'bar'>['data'] | null
  >(null);
  readonly paymentMethodData = signal<
    ChartConfiguration<'doughnut'>['data'] | null
  >(null);
  readonly monthlySalesOptions = MONTHLY_SALES_CHART_OPTIONS;
  readonly statusFunnelOptions = STATUS_FUNNEL_CHART_OPTIONS;

  readonly monthlyRevenueDisplay = computed(() => {
    const revenue = this.monthlyRevenue();
    return revenue === null ? null : formatDashboardCurrency(revenue);
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    // summary sustituye el forkJoin previo de vehicleCounts + una parte de contracts (KPIs, counts).
    // getAll() se mantiene porque alertas, sugerencias y tendencia de ventas aún requieren el
    // detalle completo; shareReplay en el servicio evita pagar dos veces en una misma navegación.
    forkJoin({
      summary: this.purchaseSaleService.getDashboardSummary().pipe(
        retry({
          count: 3,
          delay: (_error, retryCount) => {
            const delayMs = Math.pow(2, retryCount) * 1000;
            console.warn(
              `Retrying getDashboardSummary, attempt ${retryCount + 1}...`,
            );
            return timer(delayMs);
          },
        }),
      ),
      contracts: this.purchaseSaleService.getAll().pipe(
        retry({
          count: 3,
          delay: (_error, retryCount) => {
            const delayMs = Math.pow(2, retryCount) * 1000;
            console.warn(
              `Retrying getAll contracts, attempt ${retryCount + 1}...`,
            );
            return timer(delayMs);
          },
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ summary, contracts }) => {
          this.applyVehicleCountsFromSummary(summary);
          this.applySalesMetrics(contracts);
          this.allContracts.set(contracts);
          this.recentActivity.set(buildRecentActivity(contracts));
          this.dashboardAlerts.set(buildDashboardAlerts(contracts));
          this.contractStatusData.set(buildContractStatusFunnelData(contracts));
          this.paymentMethodData.set(
            buildPaymentMethodDistributionData(contracts),
          );
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set(
            'No se pudieron recuperar las métricas del inventario en este momento.',
          );
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Adapta los conteos del DashboardSummary al formato que esperan las utilidades del dashboard.
   * El endpoint agregado entrega los 4 valores en una sola respuesta, eliminando las dos llamadas
   * previas a car/motorcycle counts.
   */
  private applyVehicleCountsFromSummary(summary: DashboardSummary): void {
    const counts = {
      cars: {
        total: summary.vehicleCounts.totalCars,
        available: summary.vehicleCounts.availableCars,
        unavailable:
          summary.vehicleCounts.totalCars - summary.vehicleCounts.availableCars,
      },
      motorcycles: {
        total: summary.vehicleCounts.totalMotorcycles,
        available: summary.vehicleCounts.availableMotorcycles,
        unavailable:
          summary.vehicleCounts.totalMotorcycles -
          summary.vehicleCounts.availableMotorcycles,
      },
    };
    const result = buildInventoryChartData(counts);
    this.totalInventory.set(result.totalInventory);
    this.vehiclesToSell.set(result.vehiclesToSell);
    this.inventoryData.set(result.chartData);
  }

  private applySalesMetrics(contracts: PurchaseSale[]): void {
    const metrics = computeSalesMetrics(contracts);
    this.salesHistoryCount.set(metrics.salesHistoryCount);
    this.monthlyRevenue.set(metrics.monthlyRevenue);
    this.monthlySales.set(metrics.monthlySales);
  }

  setSalesTrendMode(mode: SalesTrendMode): void {
    this.salesTrendMode.set(mode);
  }
}

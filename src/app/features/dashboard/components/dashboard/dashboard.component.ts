import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin, of, catchError, retry, timer } from 'rxjs';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { SkeletonLoaderComponent } from '../../../../shared/components/skeleton/skeleton-loader.component';
import { PurchaseSaleService } from '../../../purchase-sales/services/purchase-sale.service';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { DashboardSummary } from '../../models/dashboard-summary.model';
import { DemandPredictionService } from '../../../../shared/services/demand-prediction.service';
import {
  DemandPredictionRequest,
  DemandMetrics,
  ModelMetadata,
  DemandPredictionResponse,
} from '../../../../shared/models/demand-prediction.model';
import { VehicleKind } from '../../../purchase-sales/models/vehicle-kind.enum';
import { VehicleOption } from '../../../purchase-sales/models/purchase-sale-reference.model';
import { DashboardStateService } from '../../services/dashboard-state.service';
import { PurchaseSaleLookupService } from '../../../purchase-sales/services/purchase-sale-lookup.service';
import {
  DEMAND_CHART_OPTIONS,
  INVENTORY_CHART_OPTIONS,
  MONTHLY_SALES_CHART_OPTIONS,
  STATUS_FUNNEL_CHART_OPTIONS,
  buildForecastChartData,
  computeDemandScaleRange,
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
import {
  SegmentOption,
  buildSegmentSuggestions,
} from '../../utils/segment-suggestion.utils';
import {
  normalizeVehicleType,
  describeSegment,
} from '../../utils/vehicle-kind.utils';
import { showConfirmDialog } from '../../../../shared/utils/swal-alert.utils';

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
    DecimalPipe,
    DatePipe,
    BaseChartDirective,
    KpiCardComponent,
    DataTableComponent,
    SkeletonLoaderComponent,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly purchaseSaleService = inject(PurchaseSaleService);
  private readonly demandPredictionService = inject(DemandPredictionService);
  private readonly dashboardStateService = inject(DashboardStateService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly lookupService = inject(PurchaseSaleLookupService);

  private readonly latestModel = signal<ModelMetadata | null>(null);
  private readonly allContracts = signal<PurchaseSale[]>([]);

  readonly totalInventory = signal<number | null>(null);
  readonly monthlySales = signal<number | null>(null);
  private readonly monthlyRevenue = signal<number | null>(null);
  readonly vehiclesToSell = signal<number | null>(null);
  readonly salesHistoryCount = signal(0);

  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly predictionForm: FormGroup = this.buildPredictionForm();
  quickVehicleTerm = signal('');
  readonly quickVehicleLoading = signal(false);
  private readonly defaultHorizon = 6;
  readonly activeSegmentLabel = signal<string | null>(null);
  readonly VehicleKind = VehicleKind;

  readonly demandData = signal<ChartConfiguration<'line'>['data'] | null>(null);
  readonly demandOptions = signal<ChartOptions<'line'>>(DEMAND_CHART_OPTIONS);
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

  readonly predictionLoading = signal(false);
  readonly predictionError = signal<string | null>(null);
  readonly retrainLoading = computed(() =>
    this.demandPredictionService.retrainLoading(),
  );
  readonly retrainError = computed(() =>
    this.demandPredictionService.retrainError(),
  );
  readonly retrainMessage = computed(() =>
    this.demandPredictionService.retrainMessage(),
  );
  readonly modelVersion = signal<string | null>(null);
  readonly forecastMetrics = signal<DemandMetrics | null>(null);
  readonly segmentSuggestions = signal<SegmentOption[]>([]);
  readonly contractedVehicles = signal<
    (VehicleOption & { contractsCount?: number })[]
  >([]);
  readonly contractedVehiclesLoading = signal(false);

  readonly monthlyRevenueDisplay = computed(() => {
    const revenue = this.monthlyRevenue();
    return revenue === null ? null : formatDashboardCurrency(revenue);
  });

  readonly latestModelValue = computed(() => this.latestModel());

  readonly noModelTrained = computed(() => {
    const model = this.latestModel();
    return model === null || (!model.version && !model.trainedAt);
  });

  readonly baselinesTooltip = computed((): string => {
    const m = this.forecastMetrics();
    if (!m?.baselines || m.rmse === undefined) return '';
    const rmse = m.rmse.toFixed(2);
    const lag1 = m.baselines.naive_lag1_rmse?.toFixed(2);
    const mean3 = m.baselines.naive_mean3_rmse?.toFixed(2);
    const lag1Check = lag1 !== undefined ? (m.rmse < +lag1 ? '✓' : '✗') : '';
    const mean3Check = mean3 !== undefined ? (m.rmse < +mean3 ? '✓' : '✗') : '';
    const parts = [`Modelo RMSE ${rmse}`];
    if (lag1 !== undefined) parts.push(`Lag-1 ${lag1} ${lag1Check}`);
    if (mean3 !== undefined) parts.push(`Media-3 ${mean3} ${mean3Check}`);
    return parts.join(' · ');
  });

  constructor() {
    effect(() => {
      if (this.lookupService.vehicles().length > 0) {
        this.contractedVehiclesLoading.set(false);
      }
    });

    effect(() => {
      const trained = this.demandPredictionService.lastTrainedModel();
      if (!trained) return;
      this.latestModel.set(trained);
      this.modelVersion.set(trained.version ?? null);
      this.forecastMetrics.set(trained.metrics ?? null);
    });
  }

  ngOnInit(): void {
    this.restoreSavedPrediction();
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
      latestModel: this.demandPredictionService
        .getLatestModel()
        .pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ summary, contracts, latestModel }) => {
          this.applyVehicleCountsFromSummary(summary);
          this.applySalesMetrics(contracts);
          this.allContracts.set(contracts);
          this.recentActivity.set(buildRecentActivity(contracts));
          this.dashboardAlerts.set(buildDashboardAlerts(contracts));
          this.contractStatusData.set(buildContractStatusFunnelData(contracts));
          this.paymentMethodData.set(
            buildPaymentMethodDistributionData(contracts),
          );
          this.loadVehicleOptions();
          this.latestModel.set(latestModel);
          this.segmentSuggestions.set(buildSegmentSuggestions(contracts));
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

  private restoreSavedPrediction(): void {
    const savedState = this.dashboardStateService.getLastPrediction();
    if (!savedState?.payload || !savedState?.response) {
      if (savedState) {
        this.dashboardStateService.clear();
      }
      return;
    }

    const vehicleType =
      normalizeVehicleType(savedState.payload.vehicleType) ?? VehicleKind.CAR;

    this.predictionForm.patchValue({
      vehicleType,
      brand: savedState.payload.brand,
      model: savedState.payload.model,
      line: savedState.payload.line ?? '',
      horizonMonths: savedState.payload.horizonMonths ?? this.defaultHorizon,
    });

    this.quickVehicleTerm.set(savedState.quickVehicleTerm ?? '');
    this.activeSegmentLabel.set(savedState.activeSegmentLabel);

    const chartResult = buildForecastChartData(
      savedState.response.predictions ?? [],
      savedState.response.history ?? [],
    );
    this.demandData.set(chartResult);
    this.updateDemandScale(chartResult);

    this.modelVersion.set(
      savedState.response.modelVersion ??
        savedState.latestModel?.version ??
        null,
    );
    this.forecastMetrics.set(
      savedState.response.metrics ?? savedState.latestModel?.metrics ?? null,
    );
    const currentLatest = savedState.latestModel ?? this.latestModel();
    if (savedState.response.trainedAt && currentLatest) {
      this.latestModel.set({
        ...currentLatest,
        trainedAt: savedState.response.trainedAt,
      });
    } else if (savedState.response.trainedAt) {
      this.latestModel.set({ trainedAt: savedState.response.trainedAt });
    } else if (currentLatest) {
      this.latestModel.set(currentLatest);
    }
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

  private buildPredictionForm(): FormGroup {
    return this.fb.group({
      vehicleType: [VehicleKind.CAR, [Validators.required]],
      brand: ['', [Validators.required]],
      model: ['', [Validators.required]],
      line: [''],
      horizonMonths: [
        6,
        [Validators.required, Validators.min(1), Validators.max(24)],
      ],
    });
  }

  private loadVehicleOptions(): void {
    this.contractedVehiclesLoading.set(true);
    this.lookupService.loadVehiclesOnly(this.destroyRef, () => {
      this.contractedVehiclesLoading.set(false);
    });
  }

  setSalesTrendMode(mode: SalesTrendMode): void {
    this.salesTrendMode.set(mode);
  }

  applySegment(segment: SegmentOption, autoRun = false): void {
    this.predictionForm.patchValue({
      vehicleType: segment.vehicleType,
      brand: segment.brand,
      model: segment.model,
      line: segment.line ?? '',
    });
    if (autoRun) {
      this.onSubmitPrediction();
    }
  }

  onSubmitPrediction(): void {
    const formValue = this.predictionForm.value;
    if (!formValue.brand || !formValue.model) {
      this.predictionError.set(
        'Selecciona un vehículo desde la búsqueda rápida para generar la predicción.',
      );
      this.demandData.set(null);
      this.activeSegmentLabel.set(null);
      return;
    }

    if (this.predictionForm.invalid) {
      this.predictionForm.markAllAsTouched();
      return;
    }

    this.predictionLoading.set(true);
    this.predictionError.set(null);
    this.demandPredictionService.retrainError.set(null);
    this.demandPredictionService.retrainMessage.set(null);

    const payload: DemandPredictionRequest = {
      vehicleType: (formValue.vehicleType as VehicleKind) ?? VehicleKind.CAR,
      brand: formValue.brand,
      model: formValue.model,
      line: formValue.line || null,
      horizonMonths: Number(formValue.horizonMonths ?? 6),
      confidence: 0.95,
    };

    this.demandPredictionService
      .predict(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const hasPredictions = response.predictions.length > 0;
          if (hasPredictions) {
            const chartResult = buildForecastChartData(
              response.predictions,
              response.history ?? [],
            );
            this.demandData.set(chartResult);
            this.updateDemandScale(chartResult);
          } else {
            this.demandData.set(null);
          }
          this.modelVersion.set(
            response.modelVersion ?? this.latestModel()?.version ?? null,
          );
          this.forecastMetrics.set(
            response.metrics ?? this.latestModel()?.metrics ?? null,
          );
          if (response.trainedAt) {
            const current = this.latestModel();
            this.latestModel.set(
              current
                ? { ...current, trainedAt: response.trainedAt }
                : { trainedAt: response.trainedAt },
            );
          }
          this.activeSegmentLabel.set(describeSegment(payload));
          if (!hasPredictions) {
            this.predictionError.set(
              'El modelo no devolvió predicciones para este segmento.',
            );
          }
          this.predictionLoading.set(false);
          this.persistPredictionState(payload, response);
        },
        error: (error) => {
          this.predictionError.set(
            error?.error?.detail ??
              'No se pudo obtener la predicción de demanda. Intenta nuevamente.',
          );
          this.predictionLoading.set(false);
          this.demandData.set(null);
          this.activeSegmentLabel.set(null);
        },
      });
  }

  private persistPredictionState(
    payload: DemandPredictionRequest,
    response: DemandPredictionResponse,
  ): void {
    if (!this.demandData()) {
      return;
    }

    const vehicleType =
      normalizeVehicleType(payload.vehicleType) ?? VehicleKind.CAR;
    const horizonMonths = payload.horizonMonths ?? this.defaultHorizon;
    const confidence = payload.confidence ?? 0.95;

    this.dashboardStateService.setLastPrediction({
      payload: {
        vehicleType,
        brand: payload.brand,
        model: payload.model,
        line: payload.line ?? null,
        horizonMonths,
        confidence,
      },
      response: {
        ...response,
        history: response.history ?? [],
      },
      activeSegmentLabel: this.activeSegmentLabel(),
      quickVehicleTerm: this.quickVehicleTerm(),
      latestModel: this.latestModel(),
    });
  }

  private updateDemandScale(
    chartResult: ChartConfiguration<'line'>['data'] | null,
  ): void {
    const extended = chartResult as
      | (ChartConfiguration<'line'>['data'] & {
          _scaleValues?: (number | null)[];
        })
      | null;
    if (extended?._scaleValues) {
      this.demandOptions.set(
        computeDemandScaleRange(this.demandOptions(), extended._scaleValues),
      );
    }
  }

  filterVehicleOptions(term: string | null): void {
    const normalized = (term ?? '').trim().toUpperCase();
    if (!normalized) {
      this.contractedVehicles.set([]);
      return;
    }
    const contracts = this.allContracts();
    this.contractedVehicles.set(
      this.lookupService
        .vehicles()
        .filter((vehicle) => {
          const label = vehicle.label.toUpperCase();
          const line = (vehicle.line ?? '').toUpperCase();
          return label.includes(normalized) || line.includes(normalized);
        })
        .map((vehicle) => ({
          ...vehicle,
          contractsCount: contracts.filter(
            (c) =>
              c.vehicleId === vehicle.id || c.vehicleSummary?.id === vehicle.id,
          ).length,
        }))
        .slice(0, 8),
    );
  }

  selectQuickVehicle(
    vehicle: VehicleOption & { contractsCount?: number },
  ): void {
    const [brand, ...rest] = vehicle.label.split(' ');
    const model = rest
      .join(' ')
      .replace(/\([^)]+\)/, '')
      .trim();
    this.predictionForm.patchValue({
      vehicleType: vehicle.type,
      brand: brand ?? vehicle.label,
      model,
      line: vehicle.line ?? '',
    });
    this.contractedVehicles.set([]);
    this.quickVehicleTerm.set(vehicle.label);
    this.onSubmitPrediction();
  }

  async onRetrain(): Promise<void> {
    const svc = this.demandPredictionService;
    if (svc.retrainLoading()) return;

    svc.retrainLoading.set(true);

    const result = await showConfirmDialog({
      title: 'Reentrenar modelo',
      text: 'El reentrenamiento puede tardar varios minutos. El modelo actual seguirá disponible hasta que termine.',
      confirmText: 'Sí, reentrenar',
      cancelText: 'Cancelar',
      icon: 'warning',
    });

    if (!result.isConfirmed) {
      svc.retrainLoading.set(false);
      return;
    }

    svc.startRetrain();
  }
}

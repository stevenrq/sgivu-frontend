import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { Subscription, forkJoin, of, map, catchError, Observable } from 'rxjs';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { CarService } from '../../../vehicles/services/car.service';
import { MotorcycleService } from '../../../vehicles/services/motorcycle.service';
import { PurchaseSaleService } from '../../../purchase-sales/services/purchase-sale.service';
import { ContractType } from '../../../purchase-sales/models/contract-type.enum';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { VehicleCount } from '../../../vehicles/interfaces/vehicle-count.interface';
import { formatCopCurrency } from '../../../../shared/utils/currency.utils';
import { DemandPredictionService } from '../../../../shared/services/demand-prediction.service';
import {
  DemandPredictionPoint,
  DemandPredictionRequest,
  DemandMetrics,
  ModelMetadata,
  DemandPredictionResponse,
} from '../../../../shared/models/demand-prediction.model';
import { VehicleKind } from '../../../purchase-sales/models/vehicle-kind.enum';
import {
  mapCarsToVehicles,
  mapMotorcyclesToVehicles,
  VehicleOption,
} from '../../../purchase-sales/models/purchase-sale-reference.model';
import { DashboardStateService } from '../../services/dashboard-state.service';

interface SegmentOption {
  vehicleType: VehicleKind;
  brand: string;
  model: string;
  line?: string | null;
  occurrences: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    BaseChartDirective,
    KpiCardComponent,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Panel principal que reúne KPIs y visualizaciones del inventario y ventas.
 * Coordina la carga simultánea de métricas y prepara los datos para Chart.js.
 */
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly subscriptions: Subscription[] = [];
  latestModel: ModelMetadata | null = null;
  private allContracts: PurchaseSale[] = [];

  totalInventory: number | null = null;
  monthlySales: number | null = null;
  monthlyRevenue: number | null = null;
  vehiclesToSell: number | null = null;
  salesHistoryCount = 0;

  isLoading = false;
  loadError: string | null = null;

  predictionForm: FormGroup;
  quickVehicleTerm = '';
  quickVehicleLoading = false;
  private readonly defaultHorizon = 6;
  activeSegmentLabel: string | null = null;
  readonly VehicleKind = VehicleKind;

  public demandData: ChartConfiguration<'line'>['data'] | null = null;

  public demandOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: { color: 'rgba(0,0,0,0.1)', lineWidth: 0.5 },
        ticks: {
          color: '#6c757d',
          callback: (value) =>
            Number(value).toLocaleString('es-CO', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 3,
            }),
          stepSize: 1,
        },
        title: {
          display: true,
          text: 'Unidades',
          color: '#495057',
        },
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#6c757d',
          maxRotation: 45,
          minRotation: 45,
        },
        title: {
          display: true,
          text: 'Mes',
          color: '#495057',
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: '#6c757d',
          filter: (legendItem) => legendItem.text !== 'IC 95% base',
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || 'Valor';
            const value =
              typeof context.parsed.y === 'number'
                ? context.parsed.y.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 3,
                  })
                : context.parsed.y;
            return `${label}: ${value} unidades`;
          },
        },
      },
    },
  };

  public inventoryData: ChartConfiguration<'doughnut'>['data'] | null = null;

  public inventoryOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#6c757d' },
      },
    },
  };

  predictionLoading = false;
  predictionError: string | null = null;
  retrainLoading = false;
  retrainError: string | null = null;
  retrainMessage: string | null = null;
  modelVersion: string | null = null;
  forecastMetrics: DemandMetrics | null = null;
  segmentSuggestions: SegmentOption[] = [];
  contractedVehicles: (VehicleOption & { contractsCount?: number })[] = [];
  contractedVehiclesLoading = false;
  vehicleOptions: VehicleOption[] = [];

  constructor(
    private readonly carService: CarService,
    private readonly motorcycleService: MotorcycleService,
    private readonly purchaseSaleService: PurchaseSaleService,
    private readonly demandPredictionService: DemandPredictionService,
    private readonly dashboardStateService: DashboardStateService,
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.predictionForm = this.buildPredictionForm();
    this.predictionForm.patchValue({ horizonMonths: this.defaultHorizon });
  }

  ngOnInit(): void {
    this.restoreSavedPrediction();
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get monthlyRevenueDisplay(): string | null {
    if (this.monthlyRevenue === null) {
      return null;
    }
    return this.formatCurrency(this.monthlyRevenue);
  }

  /**
   * Orquesta la carga inicial de métricas y distribuye los resultados en el estado local.
   * Maneja errores de red y notifica cambio al `ChangeDetectorRef` por `OnPush`.
   */
  private loadDashboardData(): void {
    this.isLoading = true;
    this.loadError = null;

    const dashboardSub = forkJoin({
      vehicleCounts: this.loadVehicleCounts(),
      contracts: this.purchaseSaleService.getAll(),
      latestModel: this.demandPredictionService
        .getLatestModel()
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ vehicleCounts, contracts, latestModel }) => {
        this.applyVehicleCounts(vehicleCounts);
        this.applySalesMetrics(contracts);
        this.allContracts = contracts;
        this.loadVehicleOptions();
        this.latestModel = latestModel;
        this.seedPredictionForm(contracts);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError =
          'No se pudieron recuperar las métricas del inventario en este momento.';
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });

    this.subscriptions.push(dashboardSub);
  }

  private restoreSavedPrediction(): void {
    const savedState = this.dashboardStateService.getLastPrediction();
    if (!savedState || !savedState.payload || !savedState.response) {
      if (savedState) {
        this.dashboardStateService.clear();
      }
      return;
    }

    const vehicleType =
      this.normalizeVehicleType(savedState.payload.vehicleType) ??
      VehicleKind.CAR;

    this.predictionForm.patchValue({
      vehicleType,
      brand: savedState.payload.brand,
      model: savedState.payload.model,
      line: savedState.payload.line ?? '',
      horizonMonths: savedState.payload.horizonMonths ?? this.defaultHorizon,
    });

    this.quickVehicleTerm = savedState.quickVehicleTerm ?? '';
    this.activeSegmentLabel = savedState.activeSegmentLabel;
    this.demandData = this.buildForecastChart(
      savedState.response.predictions ?? [],
      savedState.response.history ?? [],
    );
    this.modelVersion =
      savedState.response.modelVersion ??
      savedState.latestModel?.version ??
      null;
    this.forecastMetrics =
      savedState.response.metrics ?? savedState.latestModel?.metrics ?? null;
    this.latestModel = savedState.latestModel ?? this.latestModel;
    if (savedState.response.trainedAt) {
      this.latestModel = {
        ...(this.latestModel ?? {}),
        trainedAt: savedState.response.trainedAt,
      };
    }
    this.cdr.markForCheck();
  }

  /**
   * Solicita en paralelo los contadores de vehículos por tipo.
   */
  private loadVehicleCounts() {
    return forkJoin({
      cars: this.carService.getCounts(),
      motorcycles: this.motorcycleService.getCounts(),
    });
  }

  /**
   * Calcula inventario total y datos para el gráfico de distribución.
   *
   * @param counts Contadores de carros y motos.
   */
  private applyVehicleCounts(counts: {
    cars: VehicleCount;
    motorcycles: VehicleCount;
  }): void {
    const {
      cars: { total: totalCars, available: availableCars },
      motorcycles: { total: totalMotorcycles, available: availableMotorcycles },
    } = counts;

    this.totalInventory = totalCars + totalMotorcycles;
    this.vehiclesToSell = availableCars + availableMotorcycles;

    const breakdown = [
      { label: 'Automóviles', value: totalCars, color: '#0d6efd' },
      { label: 'Motocicletas', value: totalMotorcycles, color: '#ffc107' },
    ].filter((item) => item.value > 0);

    const labels =
      breakdown.length > 0
        ? breakdown.map((item) => item.label)
        : ['Sin datos'];
    const data =
      breakdown.length > 0 ? breakdown.map((item) => item.value) : [1];
    const backgroundColor =
      breakdown.length > 0 ? breakdown.map((item) => item.color) : ['#e9ecef'];

    this.inventoryData = {
      labels,
      datasets: [
        {
          label: 'Inventario por tipo',
          data,
          backgroundColor,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    };
  }

  /**
   * Deriva métricas de ventas (ingresos y unidades) a partir de los contratos cargados.
   *
   * @param contracts Lista completa de contratos recuperados.
   */
  private applySalesMetrics(contracts: PurchaseSale[]): void {
    this.salesHistoryCount = contracts.filter(
      (contract) => contract.contractType === ContractType.SALE,
    ).length;
    const { monthlyRevenue, monthlySalesCount } =
      this.computeMonthlySales(contracts);
    this.monthlyRevenue = monthlyRevenue;
    this.monthlySales = monthlySalesCount;
  }

  /**
   * Agrupa ventas del mes en curso para obtener ingreso mensual y cantidad de ventas.
   *
   * @param contracts Contratos obtenidos del backend.
   */
  private computeMonthlySales(contracts: PurchaseSale[]): {
    monthlyRevenue: number;
    monthlySalesCount: number;
  } {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const salesThisMonth = contracts.filter((contract) => {
      if (contract.contractType !== ContractType.SALE) {
        return false;
      }
      const timestamp = contract.updatedAt ?? contract.createdAt;
      if (!timestamp) {
        return false;
      }
      const contractDate = new Date(timestamp);
      return contractDate >= startOfMonth && contractDate <= endOfMonth;
    });

    const monthlyRevenue = salesThisMonth.reduce(
      (acc, contract) => acc + (contract.salePrice ?? 0),
      0,
    );

    return {
      monthlyRevenue,
      monthlySalesCount: salesThisMonth.length,
    };
  }

  /**
   * Aplica formato de moneda consistente para valores COP mostrados en tarjetas.
   *
   * @param value Valor numérico a formatear.
   */
  private formatCurrency(value: number): string {
    return formatCopCurrency(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  /**
   * Construye y valida el formulario de predicción de demanda.
   */
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

  /**
   * Carga opciones de vehículos desde carros y motos para autocompletar búsqueda rápida.
   * Usa el catálogo completo, pero las coincidencias se filtran al teclear.
   */
  private loadVehicleOptions(): void {
    this.contractedVehiclesLoading = true;
    const cars$ = this.carService.getAll().pipe(
      map((cars) => mapCarsToVehicles(cars)),
      catchError(() => of([])),
    );
    const motorcycles$ = this.motorcycleService.getAll().pipe(
      map((motos) => mapMotorcyclesToVehicles(motos)),
      catchError(() => of([])),
    );

    const loadSub = forkJoin({
      cars: cars$,
      motorcycles: motorcycles$,
    }).subscribe({
      next: ({ cars, motorcycles }) => {
        this.vehicleOptions = [...cars, ...motorcycles];
        this.contractedVehiclesLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.contractedVehiclesLoading = false;
        this.cdr.markForCheck();
      },
    });

    this.subscriptions.push(loadSub);
  }

  /**
   * Construye segmentos sugeridos a partir de contratos recientes y dispara una predicción inicial.
   */
  private seedPredictionForm(contracts: PurchaseSale[]): void {
    this.segmentSuggestions = this.buildSegmentSuggestions(contracts);
  }

  /**
   * Genera una lista de referencias únicas de vehículos (id y tipo) que tienen contratos.
   */
  /**
   * Procesa los contratos para hallar combinaciones frecuentes marca/modelo/tipo.
   */
  private buildSegmentSuggestions(contracts: PurchaseSale[]): SegmentOption[] {
    const counter = new Map<string, SegmentOption>();

    contracts.forEach((contract) => {
      const summary = contract.vehicleSummary;
      const vehicleType = this.normalizeVehicleType(
        (summary?.type as string | undefined) ??
          contract.vehicleData?.vehicleType,
      );
      const brand = summary?.brand ?? contract.vehicleData?.brand;
      const model = summary?.model ?? contract.vehicleData?.model;
      const line = contract.vehicleData?.line;

      if (!vehicleType || !brand || !model) {
        return;
      }

      const key = `${vehicleType}|${brand.toUpperCase()}|${model.toUpperCase()}|${
        line?.toUpperCase() ?? ''
      }`;
      const existing = counter.get(key);
      if (existing) {
        existing.occurrences += 1;
        return;
      }
      counter.set(key, {
        vehicleType,
        brand,
        model,
        line: line ?? null,
        occurrences: 1,
      });
    });

    return Array.from(counter.values())
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 6);
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
      this.predictionError =
        'Selecciona un vehículo desde la búsqueda rápida para generar la predicción.';
      this.demandData = null;
      this.activeSegmentLabel = null;
      return;
    }

    if (this.predictionForm.invalid) {
      this.predictionForm.markAllAsTouched();
      return;
    }

    this.predictionLoading = true;
    this.predictionError = null;
    this.retrainError = null;
    this.retrainMessage = null;

    const payload: DemandPredictionRequest = {
      vehicleType: (formValue.vehicleType as VehicleKind) ?? VehicleKind.CAR,
      brand: formValue.brand,
      model: formValue.model,
      line: formValue.line || null,
      horizonMonths: Number(formValue.horizonMonths ?? 6),
      confidence: 0.95,
    };

    const predictionSub = this.demandPredictionService
      .predict(payload)
      .subscribe({
        next: (response) => {
          const hasPredictions = response.predictions.length > 0;
          this.demandData = hasPredictions
            ? this.buildForecastChart(
                response.predictions,
                response.history ?? [],
              )
            : null;
          this.modelVersion =
            response.modelVersion ?? this.latestModel?.version ?? null;
          this.forecastMetrics =
            response.metrics ?? this.latestModel?.metrics ?? null;
          if (response.trainedAt) {
            this.latestModel = {
              ...(this.latestModel ?? {}),
              trainedAt: response.trainedAt,
            };
          }
          this.activeSegmentLabel = this.describeSegment(payload);
          if (!hasPredictions) {
            this.predictionError =
              'El modelo no devolvió predicciones para este segmento.';
          }
          this.predictionLoading = false;
          this.persistPredictionState(payload, response);
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.predictionError =
            error?.error?.detail ??
            'No se pudo obtener la predicción de demanda. Intenta nuevamente.';
          this.predictionLoading = false;
          this.demandData = null;
          this.activeSegmentLabel = null;
          this.cdr.markForCheck();
        },
      });

    this.subscriptions.push(predictionSub);
  }

  private persistPredictionState(
    payload: DemandPredictionRequest,
    response: DemandPredictionResponse,
  ): void {
    if (!this.demandData) {
      return;
    }

    const vehicleType =
      this.normalizeVehicleType(payload.vehicleType) ?? VehicleKind.CAR;
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
      activeSegmentLabel: this.activeSegmentLabel,
      quickVehicleTerm: this.quickVehicleTerm,
      latestModel: this.latestModel,
    });
  }

  private buildForecastChart(
    predictions: DemandPredictionPoint[],
    history: { month: string; salesCount: number }[],
  ): ChartConfiguration<'line'>['data'] {
    if (predictions.length === 0) {
      return { labels: [], datasets: [] };
    }

    const predictionMap = new Map(
      predictions.map((point) => [
        this.formatMonthKey(this.parseMonth(point.month)),
        {
          demand: point.demand,
          lowerCi: point.lowerCi,
          upperCi: point.upperCi,
        },
      ]),
    );

    const historyMap = new Map(
      history.map((point) => [
        this.formatMonthKey(this.parseMonth(point.month)),
        point.salesCount,
      ]),
    );

    const unionKeys = Array.from(
      new Set([
        ...Array.from(historyMap.keys()),
        ...Array.from(predictionMap.keys()),
      ]),
    ).sort(
      (a, b) =>
        this.parseMonthKey(a).getTime() - this.parseMonthKey(b).getTime(),
    );

    const labels = unionKeys.map((key) =>
      this.formatMonthLabel(this.parseMonthKey(key)),
    );

    const lowerBand = unionKeys.map(
      (key) => predictionMap.get(key)?.lowerCi ?? null,
    );
    const upperBand = unionKeys.map(
      (key) => predictionMap.get(key)?.upperCi ?? null,
    );
    const demandValues = unionKeys.map(
      (key) => predictionMap.get(key)?.demand ?? null,
    );
    const historicalValues = unionKeys.map(
      (key) => historyMap.get(key) ?? null,
    );

    this.updateDemandScaleRange([
      ...historicalValues,
      ...lowerBand,
      ...upperBand,
      ...demandValues,
    ]);

    return {
      labels,
      datasets: [
        {
          label: 'Demanda Predicha',
          data: demandValues,
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13,110,253,0.2)',
          fill: false,
          tension: 0,
          borderWidth: 2,
          pointBackgroundColor: '#0d6efd',
          spanGaps: true,
          order: 1,
        },
        {
          label: 'Ventas Históricas',
          data: historicalValues,
          borderColor: '#6c757d',
          backgroundColor: '#6c757d',
          fill: false,
          tension: 0,
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 6,
          pointBackgroundColor: '#6c757d',
          spanGaps: true,
          order: 0,
        },
      ],
    };
  }

  private formatMonthLabel(monthInput: string | Date): string {
    const parsed =
      monthInput instanceof Date ? monthInput : new Date(monthInput);
    const monthNames = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    return `${monthNames[parsed.getMonth()]} ${parsed.getFullYear()}`;
  }

  private updateDemandScaleRange(values: (number | null)[]): void {
    const numericValues = values.filter(
      (value): value is number => typeof value === 'number',
    );
    if (numericValues.length === 0) {
      return;
    }

    const minValue = Math.min(...numericValues);
    const maxValue = Math.max(...numericValues);
    const suggestedMin = Math.min(0, Math.floor(minValue));
    const suggestedMax = Math.max(1, maxValue) * 1.2;
    const currentScales = this.demandOptions.scales ?? {};
    const currentY =
      (currentScales as NonNullable<ChartOptions<'line'>['scales']>)['y'] ?? {};

    this.demandOptions = {
      ...this.demandOptions,
      scales: {
        ...currentScales,
        y: {
          ...currentY,
          suggestedMin,
          suggestedMax,
          beginAtZero: true,
        },
      },
    };
  }

  private findEarliestMonth(
    history: Map<string, number>,
    cutoff: Date,
    enforceCutoff = true,
  ): Date | null {
    const months = Array.from(history.keys())
      .map((key) => this.parseMonthKey(key))
      .filter((date) => (enforceCutoff ? date >= cutoff : true))
      .sort((a, b) => a.getTime() - b.getTime());

    if (months.length === 0) {
      return enforceCutoff ? cutoff : null;
    }
    return months[0];
  }

  private findLatestMonth(history: Map<string, number>): Date | null {
    const months = Array.from(history.keys()).map((key) =>
      this.parseMonthKey(key),
    );
    if (months.length === 0) {
      return null;
    }
    return months.sort((a, b) => b.getTime() - a.getTime())[0];
  }

  private maxDate(a: Date, b: Date): Date {
    return a.getTime() >= b.getTime() ? a : b;
  }

  /**
   * Normaliza texto como lo hace sgivu-ml: mayúsculas, sin acentos y solo A-Z/0-9.
   */
  private canonicalizeLabel(value?: string | null): string {
    if (!value) {
      return '';
    }
    const withoutAccents = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return withoutAccents
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildMonthSequence(start: Date, end: Date): string[] {
    const months: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    while (cursor <= end) {
      months.push(this.formatMonthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months;
  }

  private formatMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  private parseMonth(monthInput: string | Date): Date {
    if (monthInput instanceof Date) {
      return new Date(monthInput.getFullYear(), monthInput.getMonth(), 1);
    }
    const match = monthInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    const parsed = new Date(monthInput);
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  }

  private parseMonthKey(monthKey: string): Date {
    const [year, month] = monthKey.split('-').map((value) => Number(value));
    return new Date(year, month - 1, 1);
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private describeSegment(payload: DemandPredictionRequest): string {
    const typeLabel =
      payload.vehicleType === VehicleKind.MOTORCYCLE
        ? 'Motocicleta'
        : 'Automóvil';
    const base = `${typeLabel} · ${payload.brand} ${payload.model}`;
    if (payload.line) {
      return `${base} (${payload.line})`;
    }
    return base;
  }

  private normalizeVehicleType(
    value?: string | VehicleKind | null,
  ): VehicleKind | null {
    if (!value) {
      return null;
    }
    const normalized = value.toString().toUpperCase();
    if (normalized === VehicleKind.MOTORCYCLE) {
      return VehicleKind.MOTORCYCLE;
    }
    if (normalized === VehicleKind.CAR) {
      return VehicleKind.CAR;
    }
    return null;
  }

  /**
   * Filtra el catálogo de vehículos (cars + motos) por marca, modelo, placa o línea.
   * Limita a 8 resultados para mantener el dropdown manejable.
   */
  filterVehicleOptions(term: string | null): void {
    const normalized = (term ?? '').trim().toUpperCase();
    if (!normalized) {
      this.contractedVehicles = [];
      return;
    }
    this.contractedVehicles = this.vehicleOptions
      .filter((vehicle) => {
        const label = vehicle.label.toUpperCase();
        const line = (vehicle.line ?? '').toUpperCase();
        return label.includes(normalized) || line.includes(normalized);
      })
      .map((vehicle) => ({
        ...vehicle,
        contractsCount: this.countContractsForVehicle(vehicle.id),
      }))
      .slice(0, 8);
  }

  /**
   * Al seleccionar un vehículo en la búsqueda rápida, recupera su detalle completo
   * y rellena el formulario de predicción antes de lanzar la consulta.
   */
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
    this.contractedVehicles = [];
    this.quickVehicleTerm = vehicle.label;
    this.onSubmitPrediction();
  }

  /**
   * Cuenta cuántos contratos están asociados al vehículo indicado, considerando
   * el id directo y el id presente en vehicleSummary.
   */
  private countContractsForVehicle(vehicleId: number): number {
    return this.allContracts.filter(
      (contract) =>
        contract.vehicleId === vehicleId ||
        contract.vehicleSummary?.id === vehicleId,
    ).length;
  }

  /**
   * Dispara un reentrenamiento manual del modelo sin bloquear el submit.
   * Útil cuando no existe modelo entrenado todavía o se desea actualizarlo.
   */
  onRetrain(): void {
    if (this.retrainLoading) {
      return;
    }
    this.retrainLoading = true;
    this.retrainError = null;
    this.retrainMessage = null;

    const retrainSub = this.demandPredictionService.retrain().subscribe({
      next: (metadata) => {
        this.latestModel = {
          version: metadata.version,
          trainedAt: metadata.trained_at,
          metrics: metadata.metrics,
        };
        this.modelVersion = metadata.version;
        this.forecastMetrics = metadata.metrics;
        this.retrainMessage = 'Modelo reentrenado correctamente.';
        this.retrainLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.retrainError =
          error?.error?.detail ??
          'No se pudo reentrenar el modelo. Intenta nuevamente.';
        this.retrainLoading = false;
        this.cdr.markForCheck();
      },
    });

    this.subscriptions.push(retrainSub);
  }
}

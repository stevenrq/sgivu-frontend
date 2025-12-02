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
import {
  Subscription,
  forkJoin,
  of,
  switchMap,
  tap,
  map,
  catchError,
  Observable,
} from 'rxjs';
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
} from '../../../../shared/models/demand-prediction.model';
import { VehicleKind } from '../../../purchase-sales/models/vehicle-kind.enum';
import {
  mapCarsToVehicles,
  mapMotorcyclesToVehicles,
  VehicleOption,
} from '../../../purchase-sales/models/purchase-sale-reference.model';

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
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: {
          color: '#6c757d',
          callback: (value) => `${Math.round(Number(value))}`,
          stepSize: 1,
        },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#6c757d' },
      },
    },
    plugins: {
      legend: {
        labels: { color: '#6c757d' },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || 'Valor';
            const value =
              typeof context.parsed.y === 'number'
                ? context.parsed.y.toFixed(0)
                : context.parsed.y;
            return `${label}: ${value} uds`;
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
    private readonly fb: FormBuilder,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.predictionForm = this.buildPredictionForm();
    this.predictionForm.patchValue({ horizonMonths: this.defaultHorizon });
  }

  ngOnInit(): void {
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
      breakdown.length > 0 ? breakdown.map((item) => item.label) : ['Sin datos'];
    const data =
      breakdown.length > 0 ? breakdown.map((item) => item.value) : [1];
    const backgroundColor =
      breakdown.length > 0
        ? breakdown.map((item) => item.color)
        : ['#e9ecef'];

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
      horizonMonths: [6, [Validators.required, Validators.min(1), Validators.max(24)]],
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

    const loadSub = forkJoin({ cars: cars$, motorcycles: motorcycles$ }).subscribe({
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
        (summary?.type as string | undefined) ?? contract.vehicleData?.vehicleType,
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

    const payload: DemandPredictionRequest = {
      vehicleType: (formValue.vehicleType as VehicleKind) ?? VehicleKind.CAR,
      brand: formValue.brand,
      model: formValue.model,
      line: formValue.line || null,
      horizonMonths: Number(formValue.horizonMonths ?? 6),
      confidence: 0.95,
    };

    const predictionSub = this.demandPredictionService
      .retrain()
      .pipe(
        tap((metadata) => {
          this.latestModel = {
            version: metadata.version,
            trainedAt: metadata.trained_at,
            metrics: metadata.metrics,
          };
          this.modelVersion = metadata.version;
          this.forecastMetrics = metadata.metrics;
        }),
        switchMap(() => this.demandPredictionService.predict(payload)),
      )
      .subscribe({
        next: (response) => {
          const hasPredictions = response.predictions.length > 0;
          this.demandData = hasPredictions
            ? this.buildForecastChart(response.predictions)
            : null;
          this.modelVersion = response.modelVersion ?? this.latestModel?.version ?? null;
          this.forecastMetrics = response.metrics ?? this.latestModel?.metrics ?? null;
          this.activeSegmentLabel = this.describeSegment(payload);
          if (!hasPredictions) {
            this.predictionError =
              'El modelo no devolvió predicciones para este segmento.';
          }
          this.predictionLoading = false;
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

  private buildForecastChart(
    predictions: DemandPredictionPoint[],
  ): ChartConfiguration<'line'>['data'] {
    const clamp = (value: number) => Math.max(0, value);
    const labels = predictions.map((point) => this.formatMonthLabel(point.month));
    const lowerBand = predictions.map((point) => clamp(point.lowerCi));
    const upperBand = predictions.map((point, index) => {
      const upper = clamp(point.upperCi);
      return Math.max(upper, lowerBand[index]);
    });
    const demandValues = predictions.map((point) => clamp(point.demand));

    return {
      labels,
      datasets: [
        {
          label: 'Límite inferior',
          data: lowerBand,
          borderColor: 'transparent',
          backgroundColor: 'rgba(13,110,253,0.08)',
          fill: false,
          pointRadius: 0,
          tension: 0.35,
          order: 1,
        },
        {
          label: 'Intervalo de confianza',
          data: upperBand,
          borderColor: 'transparent',
          backgroundColor: 'rgba(13,110,253,0.14)',
          fill: '-1',
          pointRadius: 0,
          tension: 0.35,
          order: 1,
        },
        {
          label: 'Demanda esperada',
          data: demandValues,
          borderColor: '#0d6efd',
          backgroundColor: 'rgba(13,110,253,0.2)',
          fill: false,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#0d6efd',
          order: 0,
        },
      ],
    };
  }

  private formatMonthLabel(monthIso: string): string {
    const parsed = new Date(monthIso);
    return parsed.toLocaleDateString('es-CO', {
      month: 'short',
      year: 'numeric',
    });
  }

  private describeSegment(payload: DemandPredictionRequest): string {
    const typeLabel =
      payload.vehicleType === VehicleKind.MOTORCYCLE ? 'Motocicleta' : 'Automóvil';
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
  selectQuickVehicle(vehicle: VehicleOption & { contractsCount?: number }): void {
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
}

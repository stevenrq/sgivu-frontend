import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart, registerables } from 'chart.js';
import { of } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { CarService } from '../../../vehicles/services/car.service';
import { MotorcycleService } from '../../../vehicles/services/motorcycle.service';
import { PurchaseSaleService } from '../../../purchase-sales/services/purchase-sale.service';
import { DemandPredictionService } from '../../../../shared/services/demand-prediction.service';
import { DashboardStateService } from '../../services/dashboard-state.service';
import { VehicleCount } from '../../../vehicles/interfaces/vehicle-count.interface';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { ContractType } from '../../../purchase-sales/models/contract-type.enum';
import { ContractStatus } from '../../../purchase-sales/models/contract-status.enum';
import { PaymentMethod } from '../../../purchase-sales/models/payment-method.enum';
import { VehicleKind } from '../../../purchase-sales/models/vehicle-kind.enum';
import { VehicleStatus } from '../../../vehicles/models/vehicle-status.enum';
import { VehicleOption } from '../../../purchase-sales/models/purchase-sale-reference.model';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let dashboardStateService: jasmine.SpyObj<DashboardStateService>;

  const baseCounts: { cars: VehicleCount; motorcycles: VehicleCount } = {
    cars: { total: 0, available: 0, unavailable: 0 },
    motorcycles: { total: 0, available: 0, unavailable: 0 },
  };

  function createContract(overrides: Partial<PurchaseSale> = {}): PurchaseSale {
    return {
      clientId: overrides.clientId ?? 1,
      userId: overrides.userId ?? 2,
      vehicleId: overrides.vehicleId,
      purchasePrice: overrides.purchasePrice ?? 1000000,
      salePrice: overrides.salePrice ?? 1200000,
      contractType: overrides.contractType ?? ContractType.SALE,
      contractStatus: overrides.contractStatus ?? ContractStatus.ACTIVE,
      paymentLimitations: overrides.paymentLimitations ?? '',
      paymentTerms: overrides.paymentTerms ?? '',
      paymentMethod: overrides.paymentMethod ?? PaymentMethod.CASH,
      createdAt: overrides.createdAt,
      updatedAt: overrides.updatedAt,
      clientSummary: overrides.clientSummary,
      userSummary: overrides.userSummary,
      vehicleSummary: overrides.vehicleSummary,
      vehicleData: overrides.vehicleData,
    };
  }

  beforeAll(() => {
    Chart.register(...registerables);
  });

  beforeEach(async () => {
    const carServiceMock = jasmine.createSpyObj<CarService>('CarService', [
      'getCounts',
      'getAll',
    ]);
    const motorcycleServiceMock = jasmine.createSpyObj<MotorcycleService>(
      'MotorcycleService',
      ['getCounts', 'getAll'],
    );
    const purchaseSaleServiceMock = jasmine.createSpyObj<PurchaseSaleService>(
      'PurchaseSaleService',
      ['getAll'],
    );
    const demandPredictionServiceMock =
      jasmine.createSpyObj<DemandPredictionService>(
        'DemandPredictionService',
        ['predict', 'getLatestModel', 'retrain'],
      );
    dashboardStateService = jasmine.createSpyObj<DashboardStateService>(
      'DashboardStateService',
      ['getLastPrediction', 'setLastPrediction', 'clear'],
    );

    carServiceMock.getCounts.and.returnValue(of(baseCounts.cars));
    motorcycleServiceMock.getCounts.and.returnValue(of(baseCounts.motorcycles));
    carServiceMock.getAll.and.returnValue(of([]));
    motorcycleServiceMock.getAll.and.returnValue(of([]));
    purchaseSaleServiceMock.getAll.and.returnValue(of([]));
    demandPredictionServiceMock.getLatestModel.and.returnValue(of(null));
    demandPredictionServiceMock.predict.and.returnValue(
      of({
        predictions: [],
        history: [],
        modelVersion: 'v1',
      } as any),
    );
    demandPredictionServiceMock.retrain.and.returnValue(of());
    dashboardStateService.getLastPrediction.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: CarService, useValue: carServiceMock },
        { provide: MotorcycleService, useValue: motorcycleServiceMock },
        { provide: PurchaseSaleService, useValue: purchaseSaleServiceMock },
        {
          provide: DemandPredictionService,
          useValue: demandPredictionServiceMock,
        },
        { provide: DashboardStateService, useValue: dashboardStateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calcula las métricas del mes actual tomando solo ventas con fechas válidas', () => {
    const now = new Date();
    const currentMonthDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      10,
    ).toISOString();
    const lastMonthDate = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      5,
    ).toISOString();

    const contracts: PurchaseSale[] = [
      createContract({
        salePrice: 1_000_000,
        createdAt: currentMonthDate,
      }),
      createContract({
        salePrice: 500_000,
        createdAt: lastMonthDate,
        updatedAt: currentMonthDate,
      }),
      createContract({
        salePrice: 750_000,
        createdAt: lastMonthDate,
      }),
      createContract({
        salePrice: 900_000,
        contractType: ContractType.PURCHASE,
        createdAt: currentMonthDate,
      }),
      createContract({
        salePrice: 300_000,
        createdAt: undefined,
      }),
    ];

    (component as any).applySalesMetrics(contracts);

    expect(component.monthlySales).toBe(2);
    expect(component.monthlyRevenue).toBe(1_500_000);
    expect(component.salesHistoryCount).toBe(4);
  });

  it('deriva totales de inventario y datasets para el gráfico de distribución', () => {
    (component as any).applyVehicleCounts({
      cars: { total: 3, available: 2, unavailable: 1 },
      motorcycles: { total: 2, available: 1, unavailable: 1 },
    });

    expect(component.totalInventory).toBe(5);
    expect(component.vehiclesToSell).toBe(3);
    expect(component.inventoryData?.labels).toEqual([
      'Automóviles',
      'Motocicletas',
    ]);
    const dataset = component.inventoryData?.datasets[0];
    expect(dataset?.data).toEqual([3, 2]);
    expect(dataset?.backgroundColor).toEqual(['#0d6efd', '#ffc107']);
  });

  it('construye sugerencias de segmento ordenadas por frecuencia', () => {
    const contracts: PurchaseSale[] = [
      createContract({
        vehicleSummary: {
          id: 1,
          type: 'car',
          brand: 'Toyota',
          model: 'Corolla',
        },
      }),
      createContract({
        vehicleSummary: {
          id: 2,
          type: 'CAR',
          brand: 'Toyota',
          model: 'Corolla',
        },
      }),
      createContract({
        vehicleSummary: {
          id: 3,
          type: 'motorcycle',
          brand: 'Yamaha',
          model: 'MT-07',
        },
      }),
      createContract({
        vehicleSummary: {
          id: 4,
          type: 'car',
          model: 'Sentra',
        },
      }),
    ];

    const suggestions = (component as any).buildSegmentSuggestions(contracts);

    expect(suggestions.length).toBe(2);
    expect(suggestions[0]).toEqual(
      jasmine.objectContaining({
        vehicleType: VehicleKind.CAR,
        brand: 'Toyota',
        model: 'Corolla',
        occurrences: 2,
      }),
    );
    expect(suggestions[1]).toEqual(
      jasmine.objectContaining({
        vehicleType: VehicleKind.MOTORCYCLE,
        brand: 'Yamaha',
        model: 'MT-07',
        line: null,
        occurrences: 1,
      }),
    );
  });

  it('filtra opciones rápidas por marca/modelo/línea y cuenta contratos asociados', () => {
    const vehicles: VehicleOption[] = [
      {
        id: 1,
        label: 'Toyota Corolla (ABC123)',
        line: 'SEG',
        status: VehicleStatus.AVAILABLE,
        type: VehicleKind.CAR,
      },
      {
        id: 2,
        label: 'Yamaha MT-07 (XYZ987)',
        line: 'ABS',
        status: VehicleStatus.AVAILABLE,
        type: VehicleKind.MOTORCYCLE,
      },
    ];
    component['vehicleOptions'] = vehicles;
    component['allContracts'] = [
      createContract({ vehicleId: 1 }),
      createContract({ vehicleId: 1, vehicleSummary: { id: 1, type: 'CAR' } }),
      createContract({ vehicleId: 2 }),
    ];

    component.filterVehicleOptions('corolla');
    expect(component.contractedVehicles).toEqual([
      jasmine.objectContaining({ id: 1, contractsCount: 2 }),
    ]);

    component.filterVehicleOptions('abs');
    expect(component.contractedVehicles[0]).toEqual(
      jasmine.objectContaining({ id: 2, contractsCount: 1 }),
    );
  });

  it('fusiona historial y predicciones al construir el gráfico de demanda', () => {
    const chartData = (component as any).buildForecastChart(
      [
        { month: '2024-01-01', demand: 10, lowerCi: 8, upperCi: 12 },
        { month: '2024-02-01', demand: 15, lowerCi: 12, upperCi: 18 },
      ],
      [
        { month: '2023-12-01', salesCount: 9 },
        { month: '2024-01-01', salesCount: 11 },
      ],
    );

    expect(chartData.labels).toEqual(['Dic 2023', 'Ene 2024', 'Feb 2024']);

    const demandDataset = chartData.datasets.find(
      (dataset: any) => dataset.label === 'Demanda Predicha',
    );
    expect(demandDataset?.data).toEqual([null, 10, 15]);

    const historyDataset = chartData.datasets.find(
      (dataset: any) => dataset.label === 'Ventas Históricas',
    );
    expect(historyDataset?.data).toEqual([9, 11, null]);

    const yScale = (component.demandOptions.scales as any)['y'];
    expect(yScale.suggestedMin).toBe(0);
    expect(yScale.suggestedMax).toBeCloseTo(21.6);
  });

  it('describe segmentos de predicción incluyendo la línea cuando aplica', () => {
    const label = (component as any).describeSegment({
      vehicleType: VehicleKind.MOTORCYCLE,
      brand: 'Yamaha',
      model: 'NMAX',
      line: 'ABS',
      horizonMonths: 6,
      confidence: 0.95,
    });

    const labelWithoutLine = (component as any).describeSegment({
      vehicleType: VehicleKind.CAR,
      brand: 'Toyota',
      model: 'Corolla',
      line: null,
      horizonMonths: 6,
      confidence: 0.95,
    });

    expect(label).toBe('Motocicleta · Yamaha NMAX (ABS)');
    expect(labelWithoutLine).toBe('Automóvil · Toyota Corolla');
  });
});

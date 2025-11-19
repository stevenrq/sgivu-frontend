import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { Subscription, forkJoin } from 'rxjs';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { CarService } from '../../../vehicles/services/car.service';
import { MotorcycleService } from '../../../vehicles/services/motorcycle.service';
import { PurchaseSaleService } from '../../../purchase-sales/services/purchase-sale.service';
import { ContractType } from '../../../purchase-sales/models/contract-type.enum';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { VehicleCount } from '../../../vehicles/interfaces/vehicle-count.interface';
import { formatCopCurrency } from '../../../../shared/utils/currency.utils';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, BaseChartDirective, KpiCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly subscriptions: Subscription[] = [];

  totalInventory: number | null = null;
  monthlySales: number | null = null;
  monthlyRevenue: number | null = null;
  vehiclesToSell: number | null = null;

  isLoading = false;
  loadError: string | null = null;

  public demandData: ChartConfiguration<'line'>['data'] = {
    labels: ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'],
    datasets: [
      {
        label: 'Demanda Predicha',
        data: [12, 15, 13, 18, 20, 22],
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.3)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: 'Ventas Históricas (Año Ant.)',
        data: [10, 11, 14, 16, 15, 19],
        borderColor: '#6c757d',
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        borderWidth: 2,
      },
    ],
  };

  public demandOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { color: '#6c757d' },
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

  constructor(
    private readonly carService: CarService,
    private readonly motorcycleService: MotorcycleService,
    private readonly purchaseSaleService: PurchaseSaleService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

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

  private loadDashboardData(): void {
    this.isLoading = true;
    this.loadError = null;

    const dashboardSub = forkJoin({
      vehicleCounts: this.loadVehicleCounts(),
      contracts: this.purchaseSaleService.getAll(),
    }).subscribe({
      next: ({ vehicleCounts, contracts }) => {
        this.applyVehicleCounts(vehicleCounts);
        this.applySalesMetrics(contracts);
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

  private loadVehicleCounts() {
    return forkJoin({
      cars: this.carService.getCounts(),
      motorcycles: this.motorcycleService.getCounts(),
    });
  }

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

  private applySalesMetrics(contracts: PurchaseSale[]): void {
    const { monthlyRevenue, monthlySalesCount } =
      this.computeMonthlySales(contracts);
    this.monthlyRevenue = monthlyRevenue;
    this.monthlySales = monthlySalesCount;
  }

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

  private formatCurrency(value: number): string {
    return formatCopCurrency(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
}

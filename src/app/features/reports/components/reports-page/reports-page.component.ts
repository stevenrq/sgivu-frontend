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
import { forkJoin, of, catchError, retry, timer } from 'rxjs';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../../../shared/components/skeleton/skeleton-loader.component';
import { PurchaseSaleService } from '../../../purchase-sales/services/purchase-sale.service';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { CarService } from '../../../vehicles/services/car.service';
import { MotorcycleService } from '../../../vehicles/services/motorcycle.service';
import { Car } from '../../../vehicles/models/car.model';
import { Motorcycle } from '../../../vehicles/models/motorcycle.model';
import { ReportDateFilterComponent } from '../report-date-filter/report-date-filter.component';
import { ReportExportBarComponent } from '../report-export-bar/report-export-bar.component';
import { FinancialTabComponent } from '../financial-tab/financial-tab.component';
import { InventoryTabComponent } from '../inventory-tab/inventory-tab.component';
import { SalesClientsTabComponent } from '../sales-clients-tab/sales-clients-tab.component';
import { ProfitabilityTabComponent } from '../profitability-tab/profitability-tab.component';

type ReportTab = 'financial' | 'inventory' | 'sales-clients' | 'profitability';

@Component({
  selector: 'app-reports-page',
  imports: [
    PageHeaderComponent,
    SkeletonLoaderComponent,
    ReportDateFilterComponent,
    ReportExportBarComponent,
    FinancialTabComponent,
    InventoryTabComponent,
    SalesClientsTabComponent,
    ProfitabilityTabComponent,
  ],
  templateUrl: './reports-page.component.html',
  styleUrls: ['./reports-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPageComponent implements OnInit {
  private readonly purchaseSaleService = inject(PurchaseSaleService);
  private readonly carService = inject(CarService);
  private readonly motorcycleService = inject(MotorcycleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeTab = signal<ReportTab>('financial');
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly startDate = signal<string | null>(null);
  readonly endDate = signal<string | null>(null);

  readonly contracts = signal<PurchaseSale[]>([]);
  readonly cars = signal<Car[]>([]);
  readonly motorcycles = signal<Motorcycle[]>([]);

  readonly filteredContracts = computed(() => {
    const all = this.contracts();
    const start = this.startDate();
    const end = this.endDate();

    if (!start && !end) return all;

    return all.filter((c) => {
      const date = c.createdAt;
      if (!date) return false;
      const d = date.substring(0, 10);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.loadData();
  }

  onDateRangeChange(range: {
    startDate: string | null;
    endDate: string | null;
  }): void {
    this.startDate.set(range.startDate);
    this.endDate.set(range.endDate);
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      contracts: this.purchaseSaleService.getAll().pipe(
        retry({
          count: 3,
          delay: (_err, retryCount) => timer(Math.pow(2, retryCount) * 1000),
        }),
      ),
      cars: this.carService.getAll().pipe(catchError(() => of([] as Car[]))),
      motorcycles: this.motorcycleService
        .getAll()
        .pipe(catchError(() => of([] as Motorcycle[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ contracts, cars, motorcycles }) => {
          this.contracts.set(contracts);
          this.cars.set(cars);
          this.motorcycles.set(motorcycles);
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set(
            'No se pudieron cargar los datos para los reportes.',
          );
          this.isLoading.set(false);
        },
      });
  }
}

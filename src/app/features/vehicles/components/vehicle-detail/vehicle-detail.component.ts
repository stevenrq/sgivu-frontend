import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, combineLatest, finalize } from 'rxjs';
import Swal from 'sweetalert2';
import { Car } from '../../models/car.model';
import { Motorcycle } from '../../models/motorcycle.model';
import { VehicleStatus } from '../../models/vehicle-status.enum';
import { CarService } from '../../services/car.service';
import { MotorcycleService } from '../../services/motorcycle.service';
import { VehicleImageService } from '../../services/vehicle-image.service';
import { VehicleImageResponse } from '../../models/vehicle-image-response';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { VehicleUiHelperService } from '../../../../shared/services/vehicle-ui-helper.service';
import { UtcToGmtMinus5Pipe } from '../../../../shared/pipes/utc-to-gmt-minus5.pipe';
import { PurchaseSaleService } from '../../../purchase-sales/services/purchase-sale.service';
import { PurchaseSale } from '../../../purchase-sales/models/purchase-sale.model';
import { ContractType } from '../../../purchase-sales/models/contract-type.enum';
import { ContractStatus } from '../../../purchase-sales/models/contract-status.enum';

type VehicleDetailType = 'car' | 'motorcycle';

@Component({
  selector: 'app-vehicle-detail',
  standalone: true,
  templateUrl: './vehicle-detail.component.html',
  styleUrls: [
    '../../../../shared/styles/entity-detail-page.css',
    './vehicle-detail.component.css',
  ],
  imports: [
    CommonModule,
    RouterLink,
    HasPermissionDirective,
    CopCurrencyPipe,
    UtcToGmtMinus5Pipe,
  ],
})
/** Muestra la información completa de un vehículo y permite cambiar su estado o navegar a edición. */
export class VehicleDetailComponent implements OnInit, OnDestroy {
  protected readonly VehicleStatus = VehicleStatus;
  protected vehicle: Car | Motorcycle | null = null;
  protected readonly statusLabelMap: Record<VehicleStatus, string> = {
    [VehicleStatus.AVAILABLE]: 'Disponible',
    [VehicleStatus.SOLD]: 'Vendido',
    [VehicleStatus.IN_MAINTENANCE]: 'En mantenimiento',
    [VehicleStatus.IN_REPAIR]: 'En reparación',
    [VehicleStatus.IN_USE]: 'En uso',
    [VehicleStatus.INACTIVE]: 'Inactivo',
  };

  protected vehicleImages: VehicleImageResponse[] = [];
  protected isLoading = true;
  protected errorMessage: string | null = null;
  protected vehicleType: VehicleDetailType = 'car';
  protected currentCar: Car | null = null;
  protected currentMotorcycle: Motorcycle | null = null;
  protected purchaseHistory: PurchaseSale[] = [];
  protected historyLoading = false;
  protected historyError: string | null = null;

  private readonly subscriptions: Subscription[] = [];
  private currentVehicleId: number | null = null;
  private readonly contractTypeLabels: Record<ContractType, string> = {
    [ContractType.PURCHASE]: 'Contrato de compra',
    [ContractType.SALE]: 'Contrato de venta',
  };
  private readonly contractStatusLabels: Record<ContractStatus, string> = {
    [ContractStatus.PENDING]: 'Pendiente',
    [ContractStatus.ACTIVE]: 'Activo',
    [ContractStatus.COMPLETED]: 'Completado',
    [ContractStatus.CANCELED]: 'Cancelado',
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly carService: CarService,
    private readonly motorcycleService: MotorcycleService,
    private readonly vehicleImageService: VehicleImageService,
    private readonly vehicleUiHelper: VehicleUiHelperService,
    private readonly purchaseSaleService: PurchaseSaleService,
  ) {}

  ngOnInit(): void {
    const sub = combineLatest([this.route.paramMap, this.route.data]).subscribe(
      ([params, data]) => {
        this.vehicleType = this.normalizeType(data['vehicleType']);
        const idParam = params.get('id');
        if (!idParam) {
          return;
        }
        const id = Number(idParam);
        if (Number.isNaN(id)) {
          void Swal.fire({
            icon: 'error',
            title: 'Identificador inválido',
            text: 'El identificador proporcionado no es válido.',
          });
          void this.router.navigate(['/vehicles']);
          return;
        }
        this.loadVehicle(id);
      },
    );

    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  get isCar(): boolean {
    return this.vehicleType === 'car';
  }

  get isMotorcycle(): boolean {
    return this.vehicleType === 'motorcycle';
  }

  get typeLabel(): string {
    return this.isCar ? 'Automóvil' : 'Motocicleta';
  }

  get heroImageUrl(): string {
    const preferred =
      this.vehicleImages.find((image) => image.primary)?.url ??
      this.vehicleImages[0]?.url;
    if (preferred) {
      return preferred;
    }
    const label = encodeURIComponent(this.isCar ? 'AUTO' : 'MOTO');
    return `https://placehold.co/160x120/EFEFEF/333333?text=${label}`;
  }

  get inventoryLink(): (string | number)[] {
    return this.isCar
      ? ['/vehicles/cars/page', 0]
      : ['/vehicles/motorcycles/page', 0];
  }

  get editLink(): (string | number)[] {
    if (!this.vehicle) {
      return this.inventoryLink;
    }
    return this.isCar
      ? ['/vehicles/cars', this.vehicle.id]
      : ['/vehicles/motorcycles', this.vehicle.id];
  }

  get updatePermission(): string {
    return this.isCar ? 'car:update' : 'motorcycle:update';
  }

  statusLabel(status: VehicleStatus): string {
    return this.statusLabelMap[status] ?? status;
  }

  statusBadgeClass(status: VehicleStatus): string {
    switch (status) {
      case VehicleStatus.AVAILABLE:
        return 'bg-success';
      case VehicleStatus.SOLD:
        return 'bg-secondary';
      case VehicleStatus.IN_MAINTENANCE:
        return 'bg-warning text-dark';
      case VehicleStatus.IN_REPAIR:
        return 'bg-danger';
      case VehicleStatus.IN_USE:
        return 'bg-info text-dark';
      case VehicleStatus.INACTIVE:
      default:
        return 'bg-dark';
    }
  }

  toggleAvailability(): void {
    if (!this.vehicle) {
      return;
    }
    const nextStatus =
      this.vehicle.status === VehicleStatus.INACTIVE
        ? VehicleStatus.AVAILABLE
        : VehicleStatus.INACTIVE;
    const callback = () => this.loadVehicle(this.vehicle!.id);
    if (this.isCar) {
      this.vehicleUiHelper.updateCarStatus(
        this.vehicle.id,
        nextStatus,
        callback,
        this.vehicle.plate,
      );
    } else {
      this.vehicleUiHelper.updateMotorcycleStatus(
        this.vehicle.id,
        nextStatus,
        callback,
        this.vehicle.plate,
      );
    }
  }

  reload(): void {
    if (this.currentVehicleId === null) {
      return;
    }
    this.loadVehicle(this.currentVehicleId);
  }

  private loadVehicle(id: number): void {
    this.currentVehicleId = id;
    this.isLoading = true;
    this.errorMessage = null;
    const request$: Observable<Car | Motorcycle> =
      this.vehicleType === 'car'
        ? this.carService.getById(id)
        : this.motorcycleService.getById(id);
    const sub = request$
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (vehicle) => {
          this.vehicle = vehicle;
          if (this.isCar) {
            this.currentCar = vehicle as Car;
            this.currentMotorcycle = null;
          } else {
            this.currentMotorcycle = vehicle as Motorcycle;
            this.currentCar = null;
          }
          this.loadImages(vehicle.id);
          this.loadHistory(vehicle.id);
        },
        error: () => {
          this.vehicle = null;
          this.currentCar = null;
          this.currentMotorcycle = null;
          this.vehicleImages = [];
          this.errorMessage =
            'No se pudo cargar la información del vehículo. Intenta nuevamente.';
        },
      });
    this.subscriptions.push(sub);
  }

  protected contractTypeLabel(type: ContractType): string {
    return this.contractTypeLabels[type] ?? type;
  }

  protected contractStatusLabel(status: ContractStatus): string {
    return this.contractStatusLabels[status] ?? status;
  }

  protected contractStatusClass(status: ContractStatus): string {
    switch (status) {
      case ContractStatus.ACTIVE:
        return 'bg-info text-dark';
      case ContractStatus.COMPLETED:
        return 'bg-success';
      case ContractStatus.CANCELED:
        return 'bg-danger';
      case ContractStatus.PENDING:
      default:
        return 'bg-warning text-dark';
    }
  }

  protected historyAmount(contract: PurchaseSale): number | undefined {
    if (contract.contractType === ContractType.PURCHASE) {
      return contract.purchasePrice;
    }
    if (contract.contractType === ContractType.SALE) {
      return contract.salePrice;
    }
    return undefined;
  }

  protected historyAmountLabel(contract: PurchaseSale): string {
    return contract.contractType === ContractType.PURCHASE
      ? 'Valor de compra'
      : 'Valor de venta';
  }

  protected getHistoryClientLabel(contract: PurchaseSale): string {
    const summary = contract.clientSummary;
    if (summary) {
      const pieces = [
        summary.name ?? `Cliente #${summary.id ?? contract.clientId ?? ''}`,
      ];
      if (summary.identifier) {
        pieces.push(summary.identifier);
      }
      return pieces.join(' - ');
    }
    if (contract.clientId) {
      return `Cliente #${contract.clientId}`;
    }
    return 'Cliente no disponible';
  }

  protected getHistoryUserLabel(contract: PurchaseSale): string {
    const summary = contract.userSummary;
    if (summary) {
      const username = summary.username ? `@${summary.username}` : null;
      return [summary.fullName ?? `Usuario #${summary.id ?? ''}`, username]
        .filter(Boolean)
        .join(' ');
    }
    if (contract.userId) {
      return `Usuario #${contract.userId}`;
    }
    return 'Usuario no disponible';
  }

  protected getHistoryTimestamp(contract: PurchaseSale): string | null {
    if (contract.contractType === ContractType.PURCHASE) {
      return (
        this.vehicle?.createdAt ??
        contract.createdAt ??
        contract.updatedAt ??
        null
      );
    }
    if (contract.contractType === ContractType.SALE) {
      return (
        contract.createdAt ??
        this.vehicle?.updatedAt ??
        contract.updatedAt ??
        null
      );
    }
    return contract.updatedAt ?? contract.createdAt ?? null;
  }

  private loadImages(id: number): void {
    const sub = this.vehicleImageService.getImages(id).subscribe({
      next: (images) => {
        this.vehicleImages = images;
      },
      error: () => {
        this.vehicleImages = [];
      },
    });
    this.subscriptions.push(sub);
  }

  private loadHistory(vehicleId: number): void {
    this.historyLoading = true;
    this.historyError = null;
    const sub = this.purchaseSaleService
      .getByVehicleId(vehicleId)
      .pipe(
        finalize(() => {
          this.historyLoading = false;
        }),
      )
      .subscribe({
        next: (contracts) => {
          const sortValue = (contract: PurchaseSale): number => {
            const timestamp = this.getHistoryTimestamp(contract);
            return timestamp ? new Date(timestamp).getTime() : 0;
          };
          this.purchaseHistory = [...contracts].sort(
            (a, b) => sortValue(b) - sortValue(a),
          );
        },
        error: () => {
          this.purchaseHistory = [];
          this.historyError =
            'No se pudo cargar el historial de transacciones del vehículo.';
        },
      });
    this.subscriptions.push(sub);
  }

  private normalizeType(value: string | undefined): VehicleDetailType {
    return value === 'motorcycle' ? 'motorcycle' : 'car';
  }
}

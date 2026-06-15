import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { PurchaseSale } from '../../models/purchase-sale.model';
import { PurchaseSaleService } from '../../services/purchase-sale.service';
import { ContractStatus } from '../../models/contract-status.enum';
import {
  getStatusLabel,
  getContractTypeLabel,
  getPaymentMethodLabel,
} from '../../models/contract-labels';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { UtcToGmtMinus5Pipe } from '../../../../shared/pipes/utc-to-gmt-minus5.pipe';

/**
 * Página de detalle de un contrato de compra-venta.
 * Carga el contrato por `id` de la ruta y muestra la información del cliente,
 * vehículo, usuario responsable, condiciones económicas y estado del contrato.
 * Expone acciones de edición y eliminación condicionadas por permisos.
 */
@Component({
  selector: 'app-purchase-sale-detail',
  imports: [RouterLink, CopCurrencyPipe, UtcToGmtMinus5Pipe],
  templateUrl: './purchase-sale-detail.component.html',
  styleUrls: [
    '../../../../shared/styles/entity-detail-page.css',
    './purchase-sale-detail.component.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseSaleDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly purchaseSaleService = inject(PurchaseSaleService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly contract = signal<PurchaseSale | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly statusBadgeClass = computed(() => {
    const c = this.contract();
    if (!c) {
      return 'bg-secondary';
    }
    switch (c.contractStatus) {
      case ContractStatus.ACTIVE:
        return 'bg-primary';
      case ContractStatus.COMPLETED:
        return 'bg-success';
      case ContractStatus.CANCELED:
        return 'bg-danger';
      default:
        return 'bg-warning text-dark';
    }
  });

  protected readonly typeLabel = computed(() => {
    const c = this.contract();
    return c ? getContractTypeLabel(c.contractType) : '';
  });

  protected readonly statusLabel = computed(() => {
    const c = this.contract();
    return c ? getStatusLabel(c.contractStatus) : '';
  });

  protected readonly paymentMethodLabel = computed(() => {
    const c = this.contract();
    return c ? getPaymentMethodLabel(c.paymentMethod) : '';
  });

  protected readonly clientDetailLink = computed(() => {
    const c = this.contract();
    if (!c) {
      return ['/clients'];
    }
    const summary = c.clientSummary;
    const type = summary?.type?.toLowerCase();
    if (type === 'company') {
      return ['/clients/companies', c.clientId, 'detail'];
    }
    if (type === 'person') {
      return ['/clients/persons', c.clientId, 'detail'];
    }
    return ['/clients'];
  });

  protected readonly vehicleDetailLink = computed(() => {
    const c = this.contract();
    if (!c?.vehicleId) {
      return ['/vehicles'];
    }
    const summary = c.vehicleSummary;
    const type = summary?.type?.toLowerCase();
    if (type === 'motorcycle') {
      return ['/vehicles/motorcycles', c.vehicleId, 'details'];
    }
    return ['/vehicles/cars', c.vehicleId, 'details'];
  });

  protected readonly clientName = computed(() => {
    const c = this.contract();
    if (!c) {
      return '';
    }
    const summary = c.clientSummary;
    if (summary?.name) {
      return summary.name;
    }
    return `Cliente #${c.clientId}`;
  });

  protected readonly clientIdentifier = computed(() => {
    const c = this.contract();
    if (!c) {
      return '';
    }
    const summary = c.clientSummary;
    if (summary?.identifier) {
      return summary.identifier;
    }
    return 'Identificación no disponible';
  });

  protected readonly userName = computed(() => {
    const c = this.contract();
    if (!c) {
      return '';
    }
    const summary = c.userSummary;
    if (summary?.fullName) {
      return summary.username
        ? `${summary.fullName} (@${summary.username})`
        : summary.fullName;
    }
    return `Usuario #${c.userId}`;
  });

  protected readonly vehicleLabel = computed(() => {
    const c = this.contract();
    if (!c) {
      return '';
    }
    const summary = c.vehicleSummary;
    if (summary) {
      const pieces = [
        summary.brand,
        summary.model,
        summary.plate ? `(${summary.plate})` : null,
      ].filter(Boolean);
      if (pieces.length) {
        return pieces.join(' ');
      }
    }
    if (c.vehicleId) {
      return `Vehículo #${c.vehicleId}`;
    }
    return 'Vehículo no disponible';
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const idParam = params.get('id');
        if (!idParam) {
          void this.router.navigate(['/purchase-sales']);
          return;
        }
        const id = Number(idParam);
        if (Number.isNaN(id)) {
          void this.router.navigate(['/purchase-sales']);
          return;
        }
        this.loadContract(id);
      });
  }

  private loadContract(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.purchaseSaleService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (contract) => {
          this.contract.set(contract);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar la información del contrato.');
          this.loading.set(false);
        },
      });
  }
}

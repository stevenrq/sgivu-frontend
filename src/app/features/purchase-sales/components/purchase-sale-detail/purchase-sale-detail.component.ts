import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PurchaseSale } from '../../models/purchase-sale.model';
import { PurchaseSaleService } from '../../services/purchase-sale.service';
import { ContractStatus } from '../../models/contract-status.enum';
import { ContractType } from '../../models/contract-type.enum';
import { PaymentMethod } from '../../models/payment-method.enum';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { UtcToGmtMinus5Pipe } from '../../../../shared/pipes/utc-to-gmt-minus5.pipe';

@Component({
  selector: 'app-purchase-sale-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CopCurrencyPipe,
    UtcToGmtMinus5Pipe,
  ],
  templateUrl: './purchase-sale-detail.component.html',
  styleUrls: [
    '../../../../shared/styles/entity-detail-page.css',
    './purchase-sale-detail.component.css',
  ],
})
/** Presenta un contrato con su estado, valores y enlaces hacia edición o listado. */
export class PurchaseSaleDetailComponent implements OnInit, OnDestroy {
  protected contract: PurchaseSale | null = null;
  protected loading = true;
  protected error: string | null = null;

  private readonly subscriptions: Subscription[] = [];
  private readonly statusLabels: Record<ContractStatus, string> = {
    [ContractStatus.PENDING]: 'Pendiente',
    [ContractStatus.ACTIVE]: 'Activo',
    [ContractStatus.COMPLETED]: 'Completado',
    [ContractStatus.CANCELED]: 'Cancelado',
  };
  private readonly typeLabels: Record<ContractType, string> = {
    [ContractType.PURCHASE]: 'Contrato de compra',
    [ContractType.SALE]: 'Contrato de venta',
  };
  private readonly paymentLabels: Record<PaymentMethod, string> = {
    [PaymentMethod.CASH]: 'Efectivo',
    [PaymentMethod.BANK_TRANSFER]: 'Transferencia bancaria',
    [PaymentMethod.BANK_DEPOSIT]: 'Consignación bancaria',
    [PaymentMethod.CASHIERS_CHECK]: 'Cheque de gerencia',
    [PaymentMethod.MIXED]: 'Pago combinado',
    [PaymentMethod.FINANCING]: 'Financiación',
    [PaymentMethod.DIGITAL_WALLET]: 'Billetera digital',
    [PaymentMethod.TRADE_IN]: 'Permuta',
    [PaymentMethod.INSTALLMENT_PAYMENT]: 'Pago a plazos',
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly purchaseSaleService: PurchaseSaleService,
  ) {}

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
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
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  get statusBadgeClass(): string {
    if (!this.contract) {
      return 'bg-secondary';
    }
    switch (this.contract.contractStatus) {
      case ContractStatus.ACTIVE:
        return 'bg-primary';
      case ContractStatus.COMPLETED:
        return 'bg-success';
      case ContractStatus.CANCELED:
        return 'bg-danger';
      default:
        return 'bg-warning text-dark';
    }
  }

  get typeLabel(): string {
    if (!this.contract) {
      return '';
    }
    return this.typeLabels[this.contract.contractType] ?? this.contract.contractType;
  }

  get statusLabel(): string {
    if (!this.contract) {
      return '';
    }
    return this.statusLabels[this.contract.contractStatus] ?? this.contract.contractStatus;
  }

  get paymentMethodLabel(): string {
    if (!this.contract) {
      return '';
    }
    return this.paymentLabels[this.contract.paymentMethod] ?? this.contract.paymentMethod;
  }

  private loadContract(id: number): void {
    this.loading = true;
    this.error = null;
    const sub = this.purchaseSaleService.getById(id).subscribe({
      next: (contract) => {
        this.contract = contract;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la información del contrato.';
        this.loading = false;
      },
    });
    this.subscriptions.push(sub);
  }

  protected get clientName(): string {
    if (!this.contract) {
      return '';
    }
    const summary = this.contract.clientSummary;
    if (summary?.name) {
      return summary.name;
    }
    return `Cliente #${this.contract.clientId}`;
  }

  protected get clientIdentifier(): string {
    if (!this.contract) {
      return '';
    }
    const summary = this.contract.clientSummary;
    if (summary?.identifier) {
      return summary.identifier;
    }
    return 'Identificación no disponible';
  }

  protected get userName(): string {
    if (!this.contract) {
      return '';
    }
    const summary = this.contract.userSummary;
    if (summary?.fullName) {
      return summary.username
        ? `${summary.fullName} (@${summary.username})`
        : summary.fullName;
    }
    return `Usuario #${this.contract.userId}`;
  }

  protected get vehicleLabel(): string {
    if (!this.contract) {
      return '';
    }
    const summary = this.contract.vehicleSummary;
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
    if (this.contract.vehicleId) {
      return `Vehículo #${this.contract.vehicleId}`;
    }
    return 'Vehículo no disponible';
  }
}

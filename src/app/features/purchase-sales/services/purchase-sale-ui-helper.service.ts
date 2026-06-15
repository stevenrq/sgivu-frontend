import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import Swal from 'sweetalert2';
import { ToastService } from '../../../shared/services/toast.service';
import { showHttpError } from '../../../shared/utils/error-handler.utils';
import { themedSwalOptions } from '../../../shared/utils/swal-alert.utils';
import { ContractStatus } from '../models/contract-status.enum';
import { PurchaseSale } from '../models/purchase-sale.model';
import { PurchaseSaleService } from './purchase-sale.service';

/** Colaboradores que el listado provee a los flujos de acción. */
export interface PurchaseSaleActionContext {
  /** DestroyRef del componente para atar las suscripciones a su ciclo de vida. */
  destroyRef: DestroyRef;
  /** Decora mensajes reemplazando ids de vehículo por su etiqueta legible. */
  decorateMessage: (message: string | null) => string;
  /** Callback tras completar la acción con éxito (p. ej., recargar la página). */
  onSuccess: () => void;
}

/**
 * Servicio auxiliar de UI para las acciones del listado de compra/venta.
 * Centraliza los diálogos de confirmación (SweetAlert2 con tema) y la
 * ejecución de eliminar contrato / cambiar estado, dejando al componente
 * solo la orquestación de recarga.
 */
@Injectable({
  providedIn: 'root',
})
export class PurchaseSaleUiHelperService {
  private readonly purchaseSaleService = inject(PurchaseSaleService);
  private readonly toast = inject(ToastService);

  /**
   * Elimina un contrato previa confirmación. Solo permite eliminar
   * operaciones canceladas; en otro estado muestra una advertencia.
   */
  delete(contract: PurchaseSale, context: PurchaseSaleActionContext): void {
    if (!contract.id) {
      return;
    }

    if (contract.contractStatus !== ContractStatus.CANCELED) {
      void Swal.fire({
        ...themedSwalOptions('primary'),
        icon: 'warning',
        title: 'Acción no permitida',
        text: 'Solo se pueden eliminar operaciones canceladas.',
      });
      return;
    }

    void Swal.fire({
      ...themedSwalOptions('danger'),
      title: '¿Confirmas esta acción?',
      text: `Vas a eliminar la operación #${contract.id}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'No, cancelar',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.purchaseSaleService
        .deleteById(contract.id!)
        .pipe(takeUntilDestroyed(context.destroyRef))
        .subscribe({
          next: () => {
            const vehicleMsg = context.decorateMessage(
              contract.vehicleSummary?.plate ?? null,
            );
            this.toast.success(
              `Operación #${contract.id} eliminada correctamente.${vehicleMsg}`,
            );
            context.onSuccess();
          },
          error: (error) =>
            showHttpError(error, 'eliminar la operación', (msg) =>
              context.decorateMessage(msg),
            ),
        });
    });
  }

  /** Cambia el estado de un contrato previa confirmación. */
  updateStatus(
    contract: PurchaseSale,
    status: ContractStatus,
    context: PurchaseSaleActionContext,
  ): void {
    if (!contract.id) {
      return;
    }

    const actionLabels: Record<ContractStatus, string> = {
      [ContractStatus.PENDING]: 'marcar como pendiente',
      [ContractStatus.ACTIVE]: 'marcar como activa',
      [ContractStatus.COMPLETED]: 'marcar como completada',
      [ContractStatus.CANCELED]: 'cancelar',
    };

    void Swal.fire({
      ...themedSwalOptions('primary'),
      title: '¿Confirmas esta acción?',
      text: `Vas a ${actionLabels[status]} la operación #${contract.id}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'No, cancelar',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      const payload: PurchaseSale = { ...contract, contractStatus: status };

      this.purchaseSaleService
        .update(contract.id!, payload)
        .pipe(
          tap(() => this.toast.success('Contrato actualizado con éxito.')),
          takeUntilDestroyed(context.destroyRef),
        )
        .subscribe({
          next: () => context.onSuccess(),
          error: (error) =>
            showHttpError(error, 'actualizar el contrato', (msg) =>
              context.decorateMessage(msg),
            ),
        });
    });
  }
}

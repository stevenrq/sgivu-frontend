import { ContractType } from '../models/contract-type.enum';
import { PurchaseSale } from '../models/purchase-sale.model';
import {
  ClientOption,
  UserOption,
  VehicleOption,
} from '../models/purchase-sale-reference.model';

/**
 * Helpers puros de presentación para contratos de compra/venta.
 * Resuelven etiquetas legibles a partir de los summaries embebidos del
 * contrato, con fallback a los mapas de lookup cuando el summary no viene.
 */

/** Etiqueta legible del cliente del contrato. */
export function getClientLabel(
  contract: PurchaseSale,
  clientMap: ReadonlyMap<number, ClientOption>,
): string {
  const summary = contract.clientSummary;
  if (summary) {
    const pieces = [summary.name ?? `Cliente ##${summary.id}`];
    if (summary.identifier) {
      pieces.push(summary.identifier);
    }
    return pieces.join(' - ');
  }
  const fallback = clientMap.get(contract.clientId);
  return fallback ? fallback.label : `Cliente #${contract.clientId}`;
}

/** Etiqueta legible del usuario (vendedor) del contrato. */
export function getUserLabel(
  contract: PurchaseSale,
  userMap: ReadonlyMap<number, UserOption>,
): string {
  const summary = contract.userSummary;
  if (summary) {
    return [summary.fullName ?? `Usuario #${summary.id}`]
      .filter(Boolean)
      .join(' ');
  }
  const fallback = userMap.get(contract.userId);
  return fallback ? fallback.label : `Usuario #${contract.userId}`;
}

/** Etiqueta legible del vehículo del contrato (marca, modelo y placa). */
export function getVehicleLabel(
  contract: PurchaseSale,
  vehicleMap: ReadonlyMap<number, VehicleOption>,
): string {
  const summary = contract.vehicleSummary;
  if (summary) {
    const brand = summary.brand ?? 'Vehículo';
    const model = summary.model ?? 'N/D';
    const plate = summary.plate ?? 'N/D';
    return `${brand} ${model} (${plate})`;
  }
  if (!contract.vehicleId) {
    return 'Vehículo no disponible';
  }
  const fallback = vehicleMap.get(contract.vehicleId);
  return fallback ? fallback.label : 'Vehículo';
}

/** Fecha de compra (solo aplica a contratos de tipo PURCHASE). */
export function getPurchaseDate(
  contract: PurchaseSale,
  vehicleMap: ReadonlyMap<number, VehicleOption>,
): string | null {
  if (contract.contractType !== ContractType.PURCHASE) {
    return null;
  }
  const vehicle = getVehicleOption(contract, vehicleMap);
  return vehicle?.createdAt ?? contract.createdAt ?? null;
}

/** Fecha de venta (solo aplica a contratos de tipo SALE). */
export function getSaleDate(
  contract: PurchaseSale,
  vehicleMap: ReadonlyMap<number, VehicleOption>,
): string | null {
  if (contract.contractType !== ContractType.SALE) {
    return null;
  }
  const vehicle = getVehicleOption(contract, vehicleMap);
  return contract.createdAt ?? vehicle?.updatedAt ?? null;
}

/** Opción de vehículo asociada al contrato, si existe. */
export function getVehicleOption(
  contract: PurchaseSale,
  vehicleMap: ReadonlyMap<number, VehicleOption>,
): VehicleOption | undefined {
  return contract.vehicleId ? vehicleMap.get(contract.vehicleId) : undefined;
}

/**
 * Reemplaza menciones "vehículo con id N" en mensajes del backend por la
 * etiqueta legible del vehículo, cuando está disponible en el lookup.
 */
export function decorateVehicleMessage(
  message: string | null,
  vehicleMap: ReadonlyMap<number, VehicleOption>,
): string {
  if (!message) {
    return '';
  }
  return message.replaceAll(/veh[ií]culo con id (\d+)/gi, (_, id: string) => {
    const numericId = Number(id);
    const option = vehicleMap.get(numericId);
    return option ? option.label : `vehículo con id ${id}`;
  });
}

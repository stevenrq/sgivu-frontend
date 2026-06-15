import { PurchaseSale } from '../../purchase-sales/models/purchase-sale.model';
import { VehicleKind } from '../../purchase-sales/models/vehicle-kind.enum';
import { normalizeVehicleType } from './vehicle-kind.utils';

/**
 * Opción de segmento para el selector de predicción ML.
 * `occurrences` indica cuántos contratos históricos tiene el segmento,
 * permitiendo ordenar por relevancia (más contratos = más datos para el modelo).
 */
export interface SegmentOption {
  vehicleType: VehicleKind;
  brand: string;
  model: string;
  line?: string | null;
  occurrences: number;
}

/**
 * Genera sugerencias de segmento a partir de contratos históricos.
 * Agrupa por tipo/marca/modelo/línea, cuenta ocurrencias y devuelve
 * los 6 segmentos más frecuentes (más datos = predicciones más fiables).
 *
 * @param contracts Lista de contratos históricos para extraer segmentos.
 * @returns Lista de opciones de segmento ordenadas por relevancia.
 */
export function buildSegmentSuggestions(
  contracts: PurchaseSale[],
): SegmentOption[] {
  const counter = new Map<string, SegmentOption>();

  contracts.forEach((contract) => {
    const summary = contract.vehicleSummary;
    const vehicleType = normalizeVehicleType(
      summary?.type ?? contract.vehicleData?.vehicleType,
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

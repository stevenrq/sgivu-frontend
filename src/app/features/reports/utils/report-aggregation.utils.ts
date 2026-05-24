import { PurchaseSale } from '../../purchase-sales/models/purchase-sale.model';
import { ContractType } from '../../purchase-sales/models/contract-type.enum';
import { ContractStatus } from '../../purchase-sales/models/contract-status.enum';
import { Car } from '../../vehicles/models/car.model';
import { Motorcycle } from '../../vehicles/models/motorcycle.model';
import {
  addMonths,
  formatMonthKey,
  formatMonthLabel,
  parseMonth,
  parseMonthKey,
} from '../../dashboard/utils/dashboard-date.utils';

// ---------------------------------------------------------------------------
// Interfaces de salida
// ---------------------------------------------------------------------------

export interface RevenueVsExpenses {
  labels: string[];
  revenue: number[];
  expenses: number[];
}

export interface ProfitMarginRow {
  vehicleLabel: string;
  purchasePrice: number;
  salePrice: number;
  margin: number;
  marginPct: number;
}

export interface BrandRevenue {
  brand: string;
  revenue: number;
}

export interface AgingBucket {
  bucket: string;
  count: number;
}

export interface TurnoverData {
  rate: number;
  trend: { label: string; rate: number }[];
}

export interface VehicleComposition {
  byBodyType: { label: string; count: number }[];
  byFuelType: { label: string; count: number }[];
  byMotorcycleType: { label: string; count: number }[];
}

export interface UserPerformance {
  userName: string;
  salesCount: number;
  totalRevenue: number;
  avgDealSize: number;
}

export interface ClientDistribution {
  persons: number;
  companies: number;
}

export interface TopClient {
  clientName: string;
  type: string;
  contractCount: number;
  totalSpent: number;
}

export interface CanceledTrend {
  labels: string[];
  counts: number[];
}

export interface InventoryValue {
  totalPurchaseValue: number;
  vehicleCount: number;
  avgValue: number;
}

export interface SaleVelocityRow {
  segment: string;
  avgDays: number;
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMonthMap(
  monthsBack: number,
  referenceMonth: Date = new Date(),
): Map<string, number> {
  const anchor = new Date(
    referenceMonth.getFullYear(),
    referenceMonth.getMonth(),
    1,
  );
  const start = addMonths(anchor, -(monthsBack - 1));
  const map = new Map<string, number>();
  for (let i = 0; i < monthsBack; i++) {
    map.set(formatMonthKey(addMonths(start, i)), 0);
  }
  return map;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function resolveReferenceMonthFromContracts(contracts: PurchaseSale[]): Date {
  let latestTimestamp: number | null = null;

  for (const contract of contracts) {
    if (!contract.createdAt) {
      continue;
    }

    const parsed = new Date(contract.createdAt);
    const timestamp = parsed.getTime();
    if (Number.isNaN(timestamp)) {
      continue;
    }

    if (latestTimestamp === null || timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }
  }

  const reference = latestTimestamp ? new Date(latestTimestamp) : new Date();
  return new Date(reference.getFullYear(), reference.getMonth(), 1);
}

// ---------------------------------------------------------------------------
// 1. Ingresos vs Egresos
// ---------------------------------------------------------------------------

export function aggregateRevenueVsExpenses(
  contracts: PurchaseSale[],
  monthsBack = 12,
): RevenueVsExpenses {
  const referenceMonth = resolveReferenceMonthFromContracts(contracts);
  const revenueMap = buildMonthMap(monthsBack, referenceMonth);
  const expensesMap = buildMonthMap(monthsBack, referenceMonth);

  for (const c of contracts) {
    if (!c.createdAt) continue;
    const key = formatMonthKey(parseMonth(c.createdAt));
    if (c.contractType === ContractType.SALE && revenueMap.has(key)) {
      revenueMap.set(key, (revenueMap.get(key) ?? 0) + (c.salePrice ?? 0));
    }
    if (c.contractType === ContractType.PURCHASE && expensesMap.has(key)) {
      expensesMap.set(
        key,
        (expensesMap.get(key) ?? 0) + (c.purchasePrice ?? 0),
      );
    }
  }

  const labels = Array.from(revenueMap.keys()).map((k) =>
    formatMonthLabel(parseMonthKey(k)),
  );
  return {
    labels,
    revenue: Array.from(revenueMap.values()),
    expenses: Array.from(expensesMap.values()),
  };
}

// ---------------------------------------------------------------------------
// 2. Margen de ganancia por vehículo
// ---------------------------------------------------------------------------

export function computeProfitMargins(
  contracts: PurchaseSale[],
): ProfitMarginRow[] {
  const byVehicle = groupBy(
    contracts.filter((c) => c.vehicleId != null),
    (c) => String(c.vehicleId ?? c.vehicleSummary?.id ?? 0),
  );

  const rows: ProfitMarginRow[] = [];

  for (const [, group] of byVehicle) {
    const purchase = group.find(
      (c) => c.contractType === ContractType.PURCHASE,
    );
    const sale = group.find(
      (c) =>
        c.contractType === ContractType.SALE &&
        c.contractStatus === ContractStatus.COMPLETED,
    );
    if (!purchase || !sale) continue;

    const vs = sale.vehicleSummary ?? purchase.vehicleSummary;
    const plateSuffix = vs?.plate ? ` (${vs.plate})` : '';
    const label = vs
      ? `${vs.brand ?? ''} ${vs.model ?? ''}${plateSuffix}`.trim()
      : `Vehículo #${purchase.vehicleId}`;

    const margin = sale.salePrice - purchase.purchasePrice;
    const marginPct =
      purchase.purchasePrice > 0 ? (margin / purchase.purchasePrice) * 100 : 0;

    rows.push({
      vehicleLabel: label,
      purchasePrice: purchase.purchasePrice,
      salePrice: sale.salePrice,
      margin,
      marginPct,
    });
  }

  return rows.sort((a, b) => b.margin - a.margin);
}

// ---------------------------------------------------------------------------
// 3. Ingresos por marca
// ---------------------------------------------------------------------------

export function aggregateRevenueByBrand(
  contracts: PurchaseSale[],
  limit = 10,
): BrandRevenue[] {
  const sales = contracts.filter((c) => c.contractType === ContractType.SALE);
  const brandMap = new Map<string, number>();

  for (const c of sales) {
    const brand = c.vehicleSummary?.brand ?? 'Sin marca';
    brandMap.set(brand, (brandMap.get(brand) ?? 0) + (c.salePrice ?? 0));
  }

  return Array.from(brandMap.entries())
    .map(([brand, revenue]) => ({ brand, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// 4. Envejecimiento de inventario
// ---------------------------------------------------------------------------

export function computeInventoryAging(
  contracts: PurchaseSale[],
): AgingBucket[] {
  const buckets = [
    { bucket: '0-30 días', min: 0, max: 30, count: 0 },
    { bucket: '31-60 días', min: 31, max: 60, count: 0 },
    { bucket: '61-90 días', min: 61, max: 90, count: 0 },
    { bucket: '90+ días', min: 91, max: Infinity, count: 0 },
  ];

  const purchases = contracts.filter(
    (c) =>
      c.contractType === ContractType.PURCHASE &&
      c.vehicleSummary?.status === 'AVAILABLE' &&
      c.createdAt,
  );

  for (const c of purchases) {
    const days = Math.floor(
      (Date.now() - new Date(c.createdAt!).getTime()) / (1000 * 60 * 60 * 24),
    );
    const bucket = buckets.find((b) => days >= b.min && days <= b.max);
    if (bucket) bucket.count++;
  }

  return buckets.map(({ bucket, count }) => ({ bucket, count }));
}

// ---------------------------------------------------------------------------
// 5. Rotación de inventario
// ---------------------------------------------------------------------------

export function computeInventoryTurnover(
  contracts: PurchaseSale[],
  monthsBack = 6,
): TurnoverData {
  const referenceMonth = resolveReferenceMonthFromContracts(contracts);
  const start = addMonths(referenceMonth, -(monthsBack - 1));

  const trend: { label: string; rate: number }[] = [];
  let totalSold = 0;
  let totalInventory = 0;

  for (let i = 0; i < monthsBack; i++) {
    const monthDate = addMonths(start, i);
    const key = formatMonthKey(monthDate);

    const soldThisMonth = contracts.filter((c) => {
      if (c.contractType !== ContractType.SALE || !c.createdAt) return false;
      return formatMonthKey(parseMonth(c.createdAt)) === key;
    }).length;

    const purchasedUpToMonth = contracts.filter((c) => {
      if (c.contractType !== ContractType.PURCHASE || !c.createdAt)
        return false;
      return new Date(c.createdAt) <= addMonths(monthDate, 1);
    }).length;

    const soldUpToMonth = contracts.filter((c) => {
      if (c.contractType !== ContractType.SALE || !c.createdAt) return false;
      return new Date(c.createdAt) <= addMonths(monthDate, 1);
    }).length;

    const inventoryAtMonth = Math.max(1, purchasedUpToMonth - soldUpToMonth);
    const rate = soldThisMonth / inventoryAtMonth;

    totalSold += soldThisMonth;
    totalInventory += inventoryAtMonth;

    trend.push({
      label: formatMonthLabel(monthDate),
      rate: Math.round(rate * 100) / 100,
    });
  }

  const avgInventory = Math.max(1, totalInventory / monthsBack);
  const overallRate = Math.round((totalSold / avgInventory) * 100) / 100;

  return { rate: overallRate, trend };
}

// ---------------------------------------------------------------------------
// 6. Composición de vehículos
// ---------------------------------------------------------------------------

export function aggregateVehicleComposition(
  cars: Car[],
  motorcycles: Motorcycle[],
): VehicleComposition {
  const countField = <T>(
    items: T[],
    field: keyof T,
  ): { label: string; count: number }[] => {
    const map = new Map<string, number>();
    for (const item of items) {
      const val = String(item[field] ?? 'Sin definir');
      map.set(val, (map.get(val) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    byBodyType: countField(cars, 'bodyType'),
    byFuelType: countField(cars, 'fuelType'),
    byMotorcycleType: countField(motorcycles, 'motorcycleType'),
  };
}

// ---------------------------------------------------------------------------
// 7. Rendimiento por vendedor
// ---------------------------------------------------------------------------

export function aggregateByUser(contracts: PurchaseSale[]): UserPerformance[] {
  const sales = contracts.filter((c) => c.contractType === ContractType.SALE);
  const byUser = groupBy(sales, (c) => String(c.userSummary?.id ?? c.userId));

  return Array.from(byUser.entries())
    .map(([, group]) => {
      const userName =
        group[0].userSummary?.fullName ?? `Usuario #${group[0].userId}`;
      const totalRevenue = group.reduce(
        (sum, c) => sum + (c.salePrice ?? 0),
        0,
      );
      return {
        userName,
        salesCount: group.length,
        totalRevenue,
        avgDealSize:
          group.length > 0 ? Math.round(totalRevenue / group.length) : 0,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ---------------------------------------------------------------------------
// 8. Distribución de clientes
// ---------------------------------------------------------------------------

export function aggregateClientDistribution(
  contracts: PurchaseSale[],
): ClientDistribution {
  const seen = new Set<number>();
  let persons = 0;
  let companies = 0;

  for (const c of contracts) {
    const clientId = c.clientSummary?.id ?? c.clientId;
    if (seen.has(clientId)) continue;
    seen.add(clientId);

    if (c.clientSummary?.type === 'COMPANY') companies++;
    else persons++;
  }

  return { persons, companies };
}

// ---------------------------------------------------------------------------
// 9. Top clientes
// ---------------------------------------------------------------------------

export function aggregateTopClients(
  contracts: PurchaseSale[],
  limit = 10,
): TopClient[] {
  const byClient = groupBy(contracts, (c) =>
    String(c.clientSummary?.id ?? c.clientId),
  );

  return Array.from(byClient.entries())
    .map(([, group]) => {
      const cs = group[0].clientSummary;
      return {
        clientName: cs?.name ?? `Cliente #${group[0].clientId}`,
        type: cs?.type === 'COMPANY' ? 'Empresa' : 'Persona',
        contractCount: group.length,
        totalSpent: group.reduce(
          (sum, c) => sum + (c.salePrice ?? 0) + (c.purchasePrice ?? 0),
          0,
        ),
      };
    })
    .sort((a, b) => b.contractCount - a.contractCount)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// 10. Tendencia de cancelaciones
// ---------------------------------------------------------------------------

export function aggregateCanceledTrend(
  contracts: PurchaseSale[],
  monthsBack = 12,
): CanceledTrend {
  const monthMap = buildMonthMap(monthsBack);

  const canceled = contracts.filter(
    (c) => c.contractStatus === ContractStatus.CANCELED && c.createdAt,
  );

  for (const c of canceled) {
    const key = formatMonthKey(parseMonth(c.createdAt!));
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    }
  }

  return {
    labels: Array.from(monthMap.keys()).map((k) =>
      formatMonthLabel(parseMonthKey(k)),
    ),
    counts: Array.from(monthMap.values()),
  };
}

// ---------------------------------------------------------------------------
// 11. Valor del inventario actual
// ---------------------------------------------------------------------------

export function computeInventoryValue(
  contracts: PurchaseSale[],
): InventoryValue {
  const available = contracts.filter(
    (c) =>
      c.contractType === ContractType.PURCHASE &&
      c.vehicleSummary?.status === 'AVAILABLE',
  );

  const totalPurchaseValue = available.reduce(
    (sum, c) => sum + (c.purchasePrice ?? 0),
    0,
  );
  const vehicleCount = available.length;
  const avgValue = vehicleCount > 0 ? totalPurchaseValue / vehicleCount : 0;

  return { totalPurchaseValue, vehicleCount, avgValue };
}

// ---------------------------------------------------------------------------
// 12. Velocidad de venta por segmento
// ---------------------------------------------------------------------------

export function computeSaleVelocity(
  contracts: PurchaseSale[],
): SaleVelocityRow[] {
  const byVehicle = groupBy(
    contracts.filter((c) => c.vehicleId != null),
    (c) => String(c.vehicleId ?? 0),
  );

  const segmentData = new Map<string, number[]>();

  for (const [, group] of byVehicle) {
    const purchase = group.find(
      (c) => c.contractType === ContractType.PURCHASE && c.createdAt,
    );
    const sale = group.find(
      (c) =>
        c.contractType === ContractType.SALE &&
        c.contractStatus === ContractStatus.COMPLETED &&
        c.createdAt,
    );
    if (!purchase || !sale) continue;

    const days = Math.floor(
      (new Date(sale.createdAt!).getTime() -
        new Date(purchase.createdAt!).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const vs = sale.vehicleSummary ?? purchase.vehicleSummary;
    const segment = vs?.brand ?? 'Sin marca';
    const existing = segmentData.get(segment) ?? [];
    existing.push(Math.max(0, days));
    segmentData.set(segment, existing);
  }

  return Array.from(segmentData.entries())
    .map(([segment, daysList]) => ({
      segment,
      avgDays: Math.round(
        daysList.reduce((s, d) => s + d, 0) / daysList.length,
      ),
      count: daysList.length,
    }))
    .sort((a, b) => a.avgDays - b.avgDays);
}

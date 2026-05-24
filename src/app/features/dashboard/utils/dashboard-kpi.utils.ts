import { ContractType } from '../../purchase-sales/models/contract-type.enum';
import { ContractStatus } from '../../purchase-sales/models/contract-status.enum';
import { PurchaseSale } from '../../purchase-sales/models/purchase-sale.model';
import { formatCopCurrency } from '../../../shared/utils/currency.utils';

/** Métricas de ventas para los KPI cards del dashboard. */
export interface SalesMetrics {
  salesHistoryCount: number;
  monthlyRevenue: number;
  monthlySales: number;
}

/**
 * Calcula métricas de ventas a partir de contratos.
 * `monthlyRevenue` y `monthlySales` se calculan sobre el mes en curso
 * usando `updatedAt` (o `createdAt` como fallback) para detectar el mes.
 *
 * @param contracts Lista de contratos históricos.
 * @returns Métricas de ventas para mostrar en el dashboard.
 */
export function computeSalesMetrics(contracts: PurchaseSale[]): SalesMetrics {
  const salesHistoryCount = contracts.filter(
    (contract) =>
      contract.contractType === ContractType.SALE &&
      contract.contractStatus === ContractStatus.COMPLETED,
  ).length;

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
    if (
      contract.contractType !== ContractType.SALE ||
      contract.contractStatus !== ContractStatus.COMPLETED
    ) {
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
    salesHistoryCount,
    monthlyRevenue,
    monthlySales: salesThisMonth.length,
  };
}

export function formatDashboardCurrency(value: number): string {
  return formatCopCurrency(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

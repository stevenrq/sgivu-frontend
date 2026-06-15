import { PurchaseSale } from '../../purchase-sales/models/purchase-sale.model';
import { ContractType } from '../../purchase-sales/models/contract-type.enum';
import { ContractStatus } from '../../purchase-sales/models/contract-status.enum';

export interface DashboardAlert {
  title: string;
  description: string;
  severity: 'danger' | 'warning' | 'info';
  badgeText: string;
}

const SEVERITY_ORDER: Record<DashboardAlert['severity'], number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

function daysSince(dateStr: string): number {
  return Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function computeAgingAlerts(contracts: PurchaseSale[]): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  const purchases = contracts.filter(
    (c) =>
      c.contractType === ContractType.PURCHASE &&
      c.vehicleSummary?.status === 'AVAILABLE' &&
      c.createdAt,
  );

  for (const c of purchases) {
    const days = daysSince(c.createdAt!);
    if (days <= 60) continue;

    const vs = c.vehicleSummary!;
    const label =
      `${vs.brand ?? ''} ${vs.model ?? ''}${vs.plate ? ` (${vs.plate})` : ''}`.trim();
    const severity: DashboardAlert['severity'] =
      days > 90 ? 'danger' : 'warning';

    alerts.push({
      title: 'Inventario envejecido',
      description: label,
      severity,
      badgeText: `${days} días en inventario`,
    });
  }

  return alerts;
}

function computePendingAlerts(contracts: PurchaseSale[]): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  const pending = contracts.filter(
    (c) => c.contractStatus === ContractStatus.PENDING && c.createdAt,
  );

  for (const c of pending) {
    const days = daysSince(c.createdAt!);
    if (days <= 30) continue;

    const vs = c.vehicleSummary;
    const label = vs
      ? `${vs.brand ?? ''} ${vs.model ?? ''}${vs.plate ? ` (${vs.plate})` : ''}`.trim()
      : 'Vehículo no disponible';

    alerts.push({
      title: 'Contrato pendiente',
      description: label,
      severity: 'warning',
      badgeText: `${days} días pendiente`,
    });
  }

  return alerts;
}

export function buildDashboardAlerts(
  contracts: PurchaseSale[],
  limit = 5,
): DashboardAlert[] {
  return [...computeAgingAlerts(contracts), ...computePendingAlerts(contracts)]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, limit);
}

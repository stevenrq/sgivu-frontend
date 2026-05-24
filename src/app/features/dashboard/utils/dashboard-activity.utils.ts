import { PurchaseSale } from '../../purchase-sales/models/purchase-sale.model';
import {
  getContractTypeLabel,
  getStatusLabel,
  getStatusBadgeClass,
} from '../../purchase-sales/models/contract-labels';

export interface RecentActivity {
  type: string;
  vehicle: string;
  date: string;
  status: string;
  statusClass: string;
  contractId?: number;
}

export function buildRecentActivity(
  contracts: PurchaseSale[],
  limit = 8,
): RecentActivity[] {
  return [...contracts]
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, limit)
    .map((c) => {
      const vs = c.vehicleSummary;
      const vehicle = vs
        ? `${vs.brand ?? ''} ${vs.model ?? ''}${vs.plate ? ` (${vs.plate})` : ''}`.trim()
        : 'Vehículo no disponible';

      const raw = c.createdAt;
      const date = raw
        ? new Date(raw).toLocaleDateString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '—';

      return {
        type: getContractTypeLabel(c.contractType),
        vehicle,
        date,
        status: getStatusLabel(c.contractStatus),
        statusClass: getStatusBadgeClass(c.contractStatus),
        contractId: c.id,
      };
    });
}

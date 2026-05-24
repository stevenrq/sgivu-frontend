/**
 * Snapshot agregado del dashboard. Corresponde a DashboardSummaryResponse del backend
 * (sgivu-purchase-sale). Se obtiene con `GET /v1/purchase-sales/dashboard-summary`.
 * Cacheado 60s en el servidor; el cliente puede además cachearlo con `shareReplay`.
 */
export interface DashboardSummary {
  generatedAt: string;
  contractStatusCounts: Record<string, number>;
  paymentMethodCounts: Record<string, number>;
  monthlySales: MonthlyBucket[];
  monthlyPurchases: MonthlyBucket[];
  recentActivity: RecentActivityItem[];
  vehicleCounts: DashboardVehicleCounts;
  globalMetrics: GlobalMetrics;
}

export interface MonthlyBucket {
  month: string;
  count: number;
  totalAmount: number;
}

export interface RecentActivityItem {
  contractId: number;
  contractType: string;
  contractStatus: string;
  amount: number;
  createdAt: string;
}

export interface DashboardVehicleCounts {
  totalCars: number;
  availableCars: number;
  totalMotorcycles: number;
  availableMotorcycles: number;
}

export interface GlobalMetrics {
  totalContracts: number;
  totalRevenue: number;
  totalInvestment: number;
}

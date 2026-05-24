import { ChartConfiguration, ChartOptions } from 'chart.js';
import { DemandPredictionPoint } from '../../../shared/models/demand-prediction.model';
import { VehicleCount } from '../../vehicles/interfaces/vehicle-count.interface';
import { PurchaseSale } from '../../purchase-sales/models/purchase-sale.model';
import { ContractType } from '../../purchase-sales/models/contract-type.enum';
import { ContractStatus } from '../../purchase-sales/models/contract-status.enum';
import { PaymentMethod } from '../../purchase-sales/models/payment-method.enum';
import {
  STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../purchase-sales/models/contract-labels';
import {
  addMonths,
  formatMonthKey,
  formatMonthLabel,
  parseMonth,
  parseMonthKey,
} from './dashboard-date.utils';

/** Paleta de colores modernos para gráficos. */
export const CHART_PALETTE = {
  primary: '#6366f1',
  primaryLight: 'rgba(99, 102, 241, 0.15)',
  primaryMedium: 'rgba(99, 102, 241, 0.35)',
  secondary: '#8b5cf6',
  secondaryLight: 'rgba(139, 92, 246, 0.12)',
  history: '#64748b',
  historyDot: '#475569',
  ciBand: 'rgba(99, 102, 241, 0.08)',
  ciBorder: 'rgba(99, 102, 241, 0.25)',
  doughnut: ['#6366f1', '#f59e0b', '#10b981', '#f43f5e'],
  doughnutHover: ['#4f46e5', '#d97706', '#059669', '#e11d48'],
  statusColors: {
    pending: '#f59e0b',
    active: '#6366f1',
    completed: '#10b981',
    canceled: '#f43f5e',
  },
  extendedDoughnut: [
    '#6366f1',
    '#f59e0b',
    '#10b981',
    '#f43f5e',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#84cc16',
    '#f97316',
  ],
} as const;

/** Opciones base del gráfico de líneas de demanda. */
export const DEMAND_CHART_OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index',
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: { color: 'rgba(100,116,139,0.1)', lineWidth: 0.5 },
      ticks: {
        color: '#94a3b8',
        font: { weight: 'bold' },
        callback: (value) =>
          Number(value).toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
          }),
        stepSize: 1,
      },
      title: {
        display: true,
        text: 'Unidades',
        color: '#64748b',
        font: { weight: 'bold' },
      },
    },
    x: {
      grid: { display: false },
      ticks: {
        color: '#94a3b8',
        font: { weight: 'bold' },
        maxRotation: 45,
        minRotation: 45,
      },
      title: {
        display: true,
        text: 'Mes',
        color: '#64748b',
        font: { weight: 'bold' },
      },
    },
  },
  plugins: {
    legend: {
      labels: {
        color: '#64748b',
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
        font: { weight: 'bold' },
        filter: (legendItem) =>
          legendItem.text !== 'IC 95% base' &&
          legendItem.text !== 'IC 95% superior',
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#f1f5f9',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(99, 102, 241, 0.3)',
      borderWidth: 1,
      cornerRadius: 10,
      padding: 12,
      bodySpacing: 6,
      usePointStyle: true,
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || 'Valor';
          if (label === 'IC 95% base' || label === 'IC 95% superior') {
            return '';
          }
          const value =
            typeof context.parsed.y === 'number'
              ? context.parsed.y.toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 3,
                })
              : context.parsed.y;
          return ` ${label}: ${value} unidades`;
        },
      },
    },
  },
};

export const INVENTORY_CHART_OPTIONS: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#64748b',
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
        font: { weight: 'bold' },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#f1f5f9',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(99, 102, 241, 0.3)',
      borderWidth: 1,
      cornerRadius: 10,
      padding: 12,
    },
  },
};

/**
 * Construye los datasets del gráfico de pronóstico uniendo historia y predicciones
 * en un eje temporal continuo. Los meses se normalizan a una key común (`YYYY-MM`)
 * para alinear ambas series aunque tengan formatos de fecha distintos.
 *
 * @param predictions Puntos de predicción de demanda futura.
 * @param history Puntos de demanda histórica.
 * @returns Datos formateados para el gráfico de líneas de demanda.
 */
export function buildForecastChartData(
  predictions: DemandPredictionPoint[],
  history: { month: string; salesCount: number }[],
): ChartConfiguration<'line'>['data'] {
  if (predictions.length === 0) {
    return { labels: [], datasets: [] };
  }

  const predictionMap = new Map(
    predictions.map((point) => [
      formatMonthKey(parseMonth(point.month)),
      {
        demand: point.demand,
        lowerCi: point.lowerCi,
        upperCi: point.upperCi,
      },
    ]),
  );

  const historyMap = new Map(
    history.map((point) => [
      formatMonthKey(parseMonth(point.month)),
      point.salesCount,
    ]),
  );

  const unionKeys = Array.from(
    new Set([
      ...Array.from(historyMap.keys()),
      ...Array.from(predictionMap.keys()),
    ]),
  ).sort((a, b) => parseMonthKey(a).getTime() - parseMonthKey(b).getTime());

  const labels = unionKeys.map((key) => formatMonthLabel(parseMonthKey(key)));

  const demandValues = unionKeys.map(
    (key) => predictionMap.get(key)?.demand ?? null,
  );
  const historicalValues = unionKeys.map((key) => historyMap.get(key) ?? null);
  const lowerBand = unionKeys.map(
    (key) => predictionMap.get(key)?.lowerCi ?? null,
  );
  const upperBand = unionKeys.map(
    (key) => predictionMap.get(key)?.upperCi ?? null,
  );

  return {
    labels,
    datasets: [
      {
        label: 'IC 95% superior',
        data: upperBand,
        borderColor: CHART_PALETTE.ciBorder,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        borderWidth: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        spanGaps: true,
        order: 3,
      },
      {
        label: 'IC 95% base',
        data: lowerBand,
        borderColor: CHART_PALETTE.ciBorder,
        backgroundColor: CHART_PALETTE.ciBand,
        fill: '-1',
        tension: 0.3,
        borderWidth: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        spanGaps: true,
        order: 3,
      },
      {
        label: 'Demanda Predicha',
        data: demandValues,
        borderColor: CHART_PALETTE.primary,
        backgroundColor: CHART_PALETTE.primaryLight,
        fill: false,
        tension: 0.3,
        borderWidth: 2.5,
        pointBackgroundColor: CHART_PALETTE.primary,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        spanGaps: true,
        order: 1,
      },
      {
        label: 'Ventas Históricas',
        data: historicalValues,
        borderColor: CHART_PALETTE.history,
        backgroundColor: CHART_PALETTE.historyDot,
        fill: false,
        tension: 0.3,
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: CHART_PALETTE.historyDot,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        spanGaps: true,
        order: 0,
      },
    ],
    _scaleValues: [
      ...historicalValues,
      ...lowerBand,
      ...upperBand,
      ...demandValues,
    ],
  } as ChartConfiguration<'line'>['data'] & {
    _scaleValues: (number | null)[];
  };
}

/**
 * Calcula el rango del eje Y a partir de todos los valores (historia + predicción + intervalos de confianza)
 * para que la escala se ajuste automáticamente al rango real de los datos.
 *
 * @param baseOptions Opciones base del gráfico.
 * @param values Valores numéricos a considerar para calcular el rango.
 * @returns Nuevas opciones del gráfico con el rango ajustado.
 */
export function computeDemandScaleRange(
  baseOptions: ChartOptions<'line'>,
  values: (number | null)[],
): ChartOptions<'line'> {
  const numericValues = values.filter(
    (value): value is number => typeof value === 'number',
  );
  if (numericValues.length === 0) {
    return baseOptions;
  }

  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);
  const suggestedMin = Math.min(0, Math.floor(minValue));
  const suggestedMax = Math.max(1, maxValue) * 1.2;
  const currentScales = baseOptions.scales ?? {};
  const currentY = baseOptions.scales?.['y'] ?? {};

  return {
    ...baseOptions,
    scales: {
      ...currentScales,
      y: {
        ...currentY,
        suggestedMin,
        suggestedMax,
        beginAtZero: true,
      },
    },
  };
}

/** Desglose de inventario para el widget del dashboard. */
export interface InventoryBreakdown {
  totalInventory: number;
  vehiclesToSell: number;
  chartData: ChartConfiguration<'doughnut'>['data'];
}

/** Construye los datos del gráfico de rosquilla de inventario a partir de conteos de carros y motos.
 *
 * @param counts Conteos de vehículos por tipo (total y disponibles).
 * @returns Datos formateados para el gráfico de rosquilla de inventario.
 */
export function buildInventoryChartData(counts: {
  cars: VehicleCount;
  motorcycles: VehicleCount;
}): InventoryBreakdown {
  const {
    cars: { total: totalCars, available: availableCars },
    motorcycles: { total: totalMotorcycles, available: availableMotorcycles },
  } = counts;

  const breakdown = [
    {
      label: 'Automóviles',
      value: totalCars,
      color: CHART_PALETTE.doughnut[0],
      hoverColor: CHART_PALETTE.doughnutHover[0],
    },
    {
      label: 'Motocicletas',
      value: totalMotorcycles,
      color: CHART_PALETTE.doughnut[1],
      hoverColor: CHART_PALETTE.doughnutHover[1],
    },
  ].filter((item) => item.value > 0);

  const labels =
    breakdown.length > 0 ? breakdown.map((item) => item.label) : ['Sin datos'];
  const data = breakdown.length > 0 ? breakdown.map((item) => item.value) : [1];
  const backgroundColor =
    breakdown.length > 0 ? breakdown.map((item) => item.color) : ['#e2e8f0'];
  const hoverBackgroundColor =
    breakdown.length > 0
      ? breakdown.map((item) => item.hoverColor)
      : ['#cbd5e1'];

  return {
    totalInventory: totalCars + totalMotorcycles,
    vehiclesToSell: availableCars + availableMotorcycles,
    chartData: {
      labels,
      datasets: [
        {
          label: 'Inventario por tipo',
          data,
          backgroundColor,
          hoverBackgroundColor,
          borderColor: 'rgba(255,255,255,0.8)',
          borderWidth: 3,
          hoverOffset: 8,
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Opciones de gráficas adicionales
// ---------------------------------------------------------------------------

const SHARED_TOOLTIP = {
  backgroundColor: 'rgba(15, 23, 42, 0.9)',
  titleColor: '#f1f5f9',
  bodyColor: '#cbd5e1',
  borderColor: 'rgba(99, 102, 241, 0.3)',
  borderWidth: 1,
  cornerRadius: 10,
  padding: 12,
  bodySpacing: 6,
  usePointStyle: true,
} as const;

export const MONTHLY_SALES_CHART_OPTIONS: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(100,116,139,0.1)', lineWidth: 0.5 },
      ticks: {
        color: '#94a3b8',
        font: { weight: 'bold' },
        stepSize: 1,
        callback: (value) => Number(value).toLocaleString('es-CO'),
      },
      title: {
        display: true,
        text: 'Unidades',
        color: '#64748b',
        font: { weight: 'bold' },
      },
    },
    x: {
      grid: { display: false },
      ticks: {
        color: '#94a3b8',
        font: { weight: 'bold' },
        maxRotation: 45,
        minRotation: 45,
      },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: { ...SHARED_TOOLTIP },
  },
};

export const STATUS_FUNNEL_CHART_OPTIONS: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: 'rgba(100,116,139,0.1)', lineWidth: 0.5 },
      ticks: { color: '#94a3b8', font: { weight: 'bold' }, stepSize: 1 },
    },
    y: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { weight: 'bold' } },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: { ...SHARED_TOOLTIP },
  },
};

// ---------------------------------------------------------------------------
// Builder: tendencia de ventas mensuales (bar chart)
// ---------------------------------------------------------------------------

function parseContractMonth(contract: PurchaseSale): Date | null {
  const timestamp = contract.updatedAt ?? contract.createdAt;
  if (!timestamp) {
    return null;
  }

  const parsedMonth = parseMonth(timestamp);
  return Number.isNaN(parsedMonth.getTime()) ? null : parsedMonth;
}

function resolveReferenceMonth(sales: PurchaseSale[]): Date {
  const months = sales
    .map(parseContractMonth)
    .filter((value): value is Date => value !== null);

  if (months.length === 0) {
    return new Date();
  }

  const [firstMonth, ...remainingMonths] = months;
  return remainingMonths.reduce(
    (latest, current) =>
      current.getTime() > latest.getTime() ? current : latest,
    firstMonth,
  );
}

function resolveOldestMonth(sales: PurchaseSale[]): Date {
  const months = sales
    .map(parseContractMonth)
    .filter((value): value is Date => value !== null);

  if (months.length === 0) {
    return new Date();
  }

  const [firstMonth, ...remainingMonths] = months;
  return remainingMonths.reduce(
    (oldest, current) =>
      current.getTime() < oldest.getTime() ? current : oldest,
    firstMonth,
  );
}

function getInclusiveMonthSpan(start: Date, end: Date): number {
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  return yearDiff * 12 + monthDiff + 1;
}

export type SalesTrendMode = 'completed' | 'all';

export function buildMonthlySalesTrendData(
  contracts: PurchaseSale[],
  monthsBack?: number,
  mode: SalesTrendMode = 'completed',
): ChartConfiguration<'bar'>['data'] {
  const sales = contracts.filter(
    (c) =>
      c.contractType === ContractType.SALE &&
      (mode === 'all' || c.contractStatus === ContractStatus.COMPLETED),
  );

  const referenceMonth = resolveReferenceMonth(sales);
  const oldestMonth = resolveOldestMonth(sales);
  const rangeMonths = getInclusiveMonthSpan(oldestMonth, referenceMonth);
  const effectiveMonthsBack =
    monthsBack && monthsBack > 0 ? monthsBack : Math.max(rangeMonths, 1);

  const start = addMonths(
    new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 1),
    -(effectiveMonthsBack - 1),
  );

  const monthMap = new Map<string, number>();
  for (let i = 0; i < effectiveMonthsBack; i++) {
    monthMap.set(formatMonthKey(addMonths(start, i)), 0);
  }

  for (const sale of sales) {
    const contractMonth = parseContractMonth(sale);
    if (!contractMonth) continue;
    const key = formatMonthKey(contractMonth);
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    }
  }

  const labels = Array.from(monthMap.keys()).map((k) =>
    formatMonthLabel(parseMonthKey(k)),
  );
  const data = Array.from(monthMap.values());

  return {
    labels,
    datasets: [
      {
        label: 'Ventas',
        data,
        backgroundColor: CHART_PALETTE.primary,
        hoverBackgroundColor: '#4f46e5',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Builder: contratos por estado (horizontal bar)
// ---------------------------------------------------------------------------

export function buildContractStatusFunnelData(
  contracts: PurchaseSale[],
): ChartConfiguration<'bar'>['data'] {
  const statusOrder: ContractStatus[] = [
    ContractStatus.PENDING,
    ContractStatus.ACTIVE,
    ContractStatus.COMPLETED,
    ContractStatus.CANCELED,
  ];

  const counts = new Map<ContractStatus, number>();
  for (const status of statusOrder) counts.set(status, 0);
  for (const c of contracts) {
    const current = counts.get(c.contractStatus) ?? 0;
    counts.set(c.contractStatus, current + 1);
  }

  const { statusColors } = CHART_PALETTE;
  const colorMap: Record<string, string> = {
    [ContractStatus.PENDING]: statusColors.pending,
    [ContractStatus.ACTIVE]: statusColors.active,
    [ContractStatus.COMPLETED]: statusColors.completed,
    [ContractStatus.CANCELED]: statusColors.canceled,
  };

  return {
    labels: statusOrder.map((s) => STATUS_LABELS[s]),
    datasets: [
      {
        label: 'Contratos',
        data: statusOrder.map((s) => counts.get(s) ?? 0),
        backgroundColor: statusOrder.map((s) => colorMap[s]),
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Builder: distribución por método de pago (doughnut)
// ---------------------------------------------------------------------------

export function buildPaymentMethodDistributionData(
  contracts: PurchaseSale[],
): ChartConfiguration<'doughnut'>['data'] {
  const counts = new Map<PaymentMethod, number>();
  for (const c of contracts) {
    if (!c.paymentMethod) continue;
    counts.set(c.paymentMethod, (counts.get(c.paymentMethod) ?? 0) + 1);
  }

  const entries = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return {
      labels: ['Sin datos'],
      datasets: [
        { label: 'Método de pago', data: [1], backgroundColor: ['#e2e8f0'] },
      ],
    };
  }

  const colors = CHART_PALETTE.extendedDoughnut;

  return {
    labels: entries.map(([method]) => PAYMENT_METHOD_LABELS[method]),
    datasets: [
      {
        label: 'Método de pago',
        data: entries.map(([, count]) => count),
        backgroundColor: entries.map((_, i) => colors[i % colors.length]),
        borderColor: 'rgba(255,255,255,0.8)',
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };
}

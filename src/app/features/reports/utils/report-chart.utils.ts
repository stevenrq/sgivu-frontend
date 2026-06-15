import { ChartConfiguration, ChartOptions } from 'chart.js';
import { CHART_PALETTE } from '../../dashboard/utils/dashboard-chart.utils';
import { formatCopCurrency } from '../../../shared/utils/currency.utils';
import {
  RevenueVsExpenses,
  BrandRevenue,
  AgingBucket,
  TurnoverData,
  UserPerformance,
  ClientDistribution,
  CanceledTrend,
  SaleVelocityRow,
} from './report-aggregation.utils';

// ---------------------------------------------------------------------------
// Tooltip y estilos compartidos
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

// ---------------------------------------------------------------------------
// Opciones de gráficas
// ---------------------------------------------------------------------------

export const REVENUE_CHART_OPTIONS: ChartOptions<'bar'> = {
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
        callback: (value) => formatCopCurrency(Number(value)),
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
    legend: {
      labels: {
        color: '#64748b',
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16,
        font: { weight: 'bold' },
      },
    },
    tooltip: {
      ...SHARED_TOOLTIP,
      callbacks: {
        label: (ctx) =>
          ` ${ctx.dataset.label}: ${formatCopCurrency(ctx.parsed.y)}`,
      },
    },
  },
};

export const HORIZONTAL_BAR_OPTIONS: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: 'rgba(100,116,139,0.1)', lineWidth: 0.5 },
      ticks: {
        color: '#94a3b8',
        font: { weight: 'bold' },
        callback: (value) => formatCopCurrency(Number(value)),
      },
    },
    y: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { weight: 'bold' } },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      ...SHARED_TOOLTIP,
      callbacks: {
        label: (ctx) =>
          ` ${ctx.dataset.label}: ${formatCopCurrency(ctx.parsed.x)}`,
      },
    },
  },
};

export const REPORT_LINE_OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(100,116,139,0.1)', lineWidth: 0.5 },
      ticks: { color: '#94a3b8', font: { weight: 'bold' }, stepSize: 1 },
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

export const REPORT_DOUGHNUT_OPTIONS: ChartOptions<'doughnut'> = {
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
    tooltip: { ...SHARED_TOOLTIP },
  },
};

export const PERFORMANCE_BAR_OPTIONS: ChartOptions<'bar'> = {
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
// Builders
// ---------------------------------------------------------------------------

export function buildRevenueVsExpensesChart(
  data: RevenueVsExpenses,
): ChartConfiguration<'bar'>['data'] {
  return {
    labels: data.labels,
    datasets: [
      {
        label: 'Ingresos',
        data: data.revenue,
        backgroundColor: '#10b981',
        hoverBackgroundColor: '#059669',
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Egresos',
        data: data.expenses,
        backgroundColor: '#f43f5e',
        hoverBackgroundColor: '#e11d48',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}

export function buildRevenueByBrandChart(
  data: BrandRevenue[],
): ChartConfiguration<'bar'>['data'] {
  return {
    labels: data.map((d) => d.brand),
    datasets: [
      {
        label: 'Ingresos',
        data: data.map((d) => d.revenue),
        backgroundColor: CHART_PALETTE.primary,
        hoverBackgroundColor: '#4f46e5',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}

export function buildInventoryAgingChart(
  data: AgingBucket[],
): ChartConfiguration<'bar'>['data'] {
  const agingColors = ['#10b981', '#f59e0b', '#f97316', '#f43f5e'];

  return {
    labels: data.map((d) => d.bucket),
    datasets: [
      {
        label: 'Vehículos',
        data: data.map((d) => d.count),
        backgroundColor: agingColors.slice(0, data.length),
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}

export function buildTurnoverTrendChart(
  data: TurnoverData,
): ChartConfiguration<'line'>['data'] {
  return {
    labels: data.trend.map((t) => t.label),
    datasets: [
      {
        label: 'Rotación',
        data: data.trend.map((t) => t.rate),
        borderColor: CHART_PALETTE.primary,
        backgroundColor: CHART_PALETTE.primaryLight,
        fill: true,
        tension: 0.3,
        borderWidth: 2.5,
        pointBackgroundColor: CHART_PALETTE.primary,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
      },
    ],
  };
}

export function buildCompositionDoughnut(
  items: { label: string; count: number }[],
): ChartConfiguration<'doughnut'>['data'] {
  const colors = CHART_PALETTE.extendedDoughnut;

  if (items.length === 0) {
    return {
      labels: ['Sin datos'],
      datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }],
    };
  }

  return {
    labels: items.map((i) => i.label),
    datasets: [
      {
        data: items.map((i) => i.count),
        backgroundColor: items.map((_, idx) => colors[idx % colors.length]),
        borderColor: 'rgba(255,255,255,0.8)',
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };
}

export function buildPerformanceByUserChart(
  data: UserPerformance[],
): ChartConfiguration<'bar'>['data'] {
  return {
    labels: data.map((d) => d.userName),
    datasets: [
      {
        label: 'Ventas',
        data: data.map((d) => d.salesCount),
        backgroundColor: CHART_PALETTE.primary,
        hoverBackgroundColor: '#4f46e5',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}

export function buildClientDistributionChart(
  data: ClientDistribution,
): ChartConfiguration<'doughnut'>['data'] {
  return {
    labels: ['Personas', 'Empresas'],
    datasets: [
      {
        data: [data.persons, data.companies],
        backgroundColor: [CHART_PALETTE.primary, '#f59e0b'],
        borderColor: 'rgba(255,255,255,0.8)',
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };
}

export function buildCanceledTrendChart(
  data: CanceledTrend,
): ChartConfiguration<'line'>['data'] {
  return {
    labels: data.labels,
    datasets: [
      {
        label: 'Cancelaciones',
        data: data.counts,
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        fill: true,
        tension: 0.3,
        borderWidth: 2.5,
        pointBackgroundColor: '#f43f5e',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Opciones adicionales
// ---------------------------------------------------------------------------

export const VELOCITY_BAR_OPTIONS: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: 'rgba(100,116,139,0.1)', lineWidth: 0.5 },
      ticks: {
        color: '#94a3b8',
        font: { weight: 'bold' },
        callback: (value) => `${value} días`,
      },
    },
    y: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { weight: 'bold' } },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      ...SHARED_TOOLTIP,
      callbacks: {
        label: (ctx) => ` ${ctx.parsed.x} días promedio`,
      },
    },
  },
};

// ---------------------------------------------------------------------------
export function buildSaleVelocityChart(
  data: SaleVelocityRow[],
): ChartConfiguration<'bar'>['data'] {
  return {
    labels: data.map((d) => `${d.segment} (${d.count})`),
    datasets: [
      {
        label: 'Días promedio',
        data: data.map((d) => d.avgDays),
        backgroundColor: CHART_PALETTE.primary,
        hoverBackgroundColor: '#4f46e5',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
}

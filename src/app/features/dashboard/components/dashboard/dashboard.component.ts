import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-dashboard',
  imports: [BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  public demandData: ChartConfiguration<'line'>['data'] = {
    labels: ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'],
    datasets: [
      {
        label: 'Demanda Predicha',
        data: [12, 15, 13, 18, 20, 22],
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.3)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: 'Ventas Históricas (Año Ant.)',
        data: [10, 11, 14, 16, 15, 19],
        borderColor: '#6c757d',
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        borderWidth: 2,
      },
    ],
  };

  public demandOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { color: '#6c757d' },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#6c757d' },
      },
    },
    plugins: {
      legend: {
        labels: { color: '#6c757d' },
      },
    },
  };

  public inventoryData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Motos', 'Automóviles', 'Camionetas'],
    datasets: [
      {
        label: 'Tipo de Vehículo',
        data: [45, 30, 11],
        backgroundColor: ['#0d6efd', '#198754', '#ffc107'],
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  public inventoryOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#6c757d' },
      },
    },
  };
}

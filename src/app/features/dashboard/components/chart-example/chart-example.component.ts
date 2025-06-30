import { Component } from '@angular/core';
import { ChartDataset, ChartOptions, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-chart-example',
  imports: [BaseChartDirective],
  templateUrl: './chart-example.component.html',
  styleUrl: './chart-example.component.css',
})
export class ChartExampleComponent {
  public lineChartData: ChartDataset[] = [
    { data: [65, 59, 80, 81, 56, 55, 40], label: 'Ventas' },
  ];

  public lineChartLabels: string[] = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
  ];

  public lineChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
  };

  public lineChartLegend = true;
  public lineChartType: ChartType = 'line';
}

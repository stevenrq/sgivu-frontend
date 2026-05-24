import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CarListComponent } from '../car-list/car-list.component';
import { MotorcycleListComponent } from '../motorcycle-list/motorcycle-list.component';

type VehicleTab = 'car' | 'motorcycle';

/**
 * Componente contenedor del inventario de vehículos.
 * Gestiona las pestañas "Automóviles" y "Motocicletas" y delega el renderizado
 * a `CarListComponent` y `MotorcycleListComponent`.
 * La pestaña activa se determina por el dato `vehicleType` de la ruta.
 */
@Component({
  selector: 'app-vehicle-list',
  imports: [
    HasPermissionDirective,
    PageHeaderComponent,
    CarListComponent,
    MotorcycleListComponent,
  ],
  templateUrl: './vehicle-list.component.html',
  styleUrl: './vehicle-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeTab = signal<VehicleTab>('car');

  ngOnInit(): void {
    const vehicleType = this.route.snapshot.data['vehicleType'];
    this.activeTab.set(vehicleType === 'motorcycle' ? 'motorcycle' : 'car');
  }

  get createLabel(): string {
    return this.activeTab() === 'car'
      ? 'Registrar automóvil'
      : 'Registrar motocicleta';
  }

  /**
   * Cambia la pestaña activa y navega a la primera página del sub-listado correspondiente.
   *
   * @param tab - Pestaña destino (`'car'` o `'motorcycle'`).
   */
  switchTab(tab: VehicleTab): void {
    if (this.activeTab() === tab) {
      return;
    }
    this.activeTab.set(tab);
    const commands =
      tab === 'car'
        ? ['/vehicles/cars/page', 0]
        : ['/vehicles/motorcycles/page', 0];
    void this.router.navigate(commands);
  }

  /**
   * Navega al formulario de registro de contrato de compra para el tipo de vehículo activo,
   * preseleccionando el tipo de contrato `PURCHASE` y el tipo de vehículo correspondiente.
   */
  startPurchaseFlow(): void {
    const vehicleKind = this.activeTab() === 'car' ? 'CAR' : 'MOTORCYCLE';
    void this.router.navigate(['/purchase-sales/register'], {
      queryParams: {
        contractType: 'PURCHASE',
        vehicleKind,
      },
    });
  }
}

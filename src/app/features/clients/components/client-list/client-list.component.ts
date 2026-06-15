import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PersonListComponent } from '../person-list/person-list.component';
import { CompanyListComponent } from '../company-list/company-list.component';

type ClientTab = 'person' | 'company';

/**
 * Componente contenedor del listado de clientes.
 * Gestiona las pestañas "Personas" y "Empresas" y delega el renderizado
 * de cada sub-lista a `PersonListComponent` y `CompanyListComponent`.
 * La pestaña activa se determina por el dato `clientType` de la ruta.
 */
@Component({
  selector: 'app-client-list',
  imports: [
    RouterLink,
    HasPermissionDirective,
    PageHeaderComponent,
    PersonListComponent,
    CompanyListComponent,
  ],
  templateUrl: './client-list.component.html',
  styleUrl: './client-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeTab = signal<ClientTab>('person');

  private readonly tabConfig: Record<
    ClientTab,
    { createPermission: string; createLink: string[]; createLabel: string }
  > = {
    person: {
      createPermission: 'person:create',
      createLink: ['/clients/persons/create'],
      createLabel: 'Registrar persona',
    },
    company: {
      createPermission: 'company:create',
      createLink: ['/clients/companies/create'],
      createLabel: 'Registrar empresa',
    },
  };

  get activeCreatePermission(): string {
    return this.tabConfig[this.activeTab()].createPermission;
  }

  get activeCreateLink(): string[] {
    return [...this.tabConfig[this.activeTab()].createLink];
  }

  get activeCreateLabel(): string {
    return this.tabConfig[this.activeTab()].createLabel;
  }

  ngOnInit(): void {
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.activeTab.set(this.normalizeTab(data['clientType']));
      });
  }

  /**
   * Cambia la pestaña activa y navega a la primera página del sub-listado correspondiente.
   *
   * @param tab - Pestaña destino (`'person'` o `'company'`).
   */
  protected switchTab(tab: ClientTab): void {
    if (this.activeTab() === tab) {
      return;
    }
    const route =
      tab === 'person'
        ? ['/clients/persons/page', 0]
        : ['/clients/companies/page', 0];
    void this.router.navigate(route);
  }

  private normalizeTab(value: unknown): ClientTab {
    if (typeof value === 'string' && value.toLowerCase() === 'company') {
      return 'company';
    }
    return 'person';
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, combineLatest, finalize, Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { PersonService } from '../../services/person.service';
import { CompanyService } from '../../services/company.service';
import { Person } from '../../models/person.model.';
import { Company } from '../../models/company.model';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { ClientUiHelperService } from '../../../../shared/services/client-ui-helper.service';

type ClientDetailType = 'person' | 'company';

interface ChecklistItem {
  label: string;
  description: string;
  valid: boolean;
}

@Component({
  selector: 'app-client-detail',
  standalone: true,
  templateUrl: './client-detail.component.html',
  styleUrls: [
    '../../../../shared/styles/entity-detail-page.css',
    './client-detail.component.css',
  ],
  imports: [CommonModule, RouterLink, HasPermissionDirective],
})
/**
 * Pantalla de detalle que muestra la información completa de un cliente,
 * permitiendo activar/desactivar y navegar hacia edición según su tipo
 * (persona o empresa).
 */
export class ClientDetailComponent implements OnInit, OnDestroy {
  protected clientType: ClientDetailType = 'person';
  protected person: Person | null = null;
  protected company: Company | null = null;
  protected isLoading = true;
  protected errorMessage: string | null = null;

  private readonly subscriptions: Subscription[] = [];
  private currentClientId: number | null = null;

  private readonly typeLabels: Record<ClientDetailType, string> = {
    person: 'Cliente persona natural',
    company: 'Cliente empresa',
  };

  private readonly listLinks: Record<ClientDetailType, (string | number)[]> = {
    person: ['/clients/persons/page', 0],
    company: ['/clients/companies/page', 0],
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly personService: PersonService,
    private readonly companyService: CompanyService,
    private readonly clientUiHelper: ClientUiHelperService,
  ) {}

  ngOnInit(): void {
    const sub = combineLatest([this.route.paramMap, this.route.data]).subscribe(
      ([params, data]) => {
        this.clientType = this.normalizeType(data['clientType']);
        const idParam = params.get('id');
        if (!idParam) {
          this.handleInvalidId();
          return;
        }
        const id = Number(idParam);
        if (Number.isNaN(id)) {
          this.handleInvalidId();
          return;
        }
        this.currentClientId = id;
        this.loadClient(id);
      },
    );
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  get isPerson(): boolean {
    return this.clientType === 'person';
  }

  get entity(): Person | Company | null {
    return this.isPerson ? this.person : this.company;
  }

  get heroTitle(): string {
    if (this.isPerson && this.person) {
      return `${this.person.firstName} ${this.person.lastName}`.trim();
    }
    if (!this.isPerson && this.company) {
      return this.company.companyName;
    }
    return this.typeLabels[this.clientType];
  }

  get heroSubtitle(): string {
    const docValue = this.documentValue ?? 'Sin registro';
    const prefix = this.isPerson ? 'C.C.' : 'NIT';
    return `${prefix} ${docValue} · ${this.typeLabels[this.clientType]}`;
  }

  get clientTypeLabel(): string {
    return this.typeLabels[this.clientType];
  }

  get heroInitials(): string {
    if (this.isPerson && this.person) {
      const first = this.person.firstName?.charAt(0) ?? '';
      const last = this.person.lastName?.charAt(0) ?? '';
      return `${first}${last}`.toUpperCase() || 'PN';
    }
    if (!this.isPerson && this.company?.companyName) {
      const name = this.company.companyName.replace(/[^A-Za-z0-9]/g, '');
      return name.substring(0, 2).toUpperCase() || 'EM';
    }
    return this.isPerson ? 'PN' : 'EM';
  }

  get heroImageUrl(): string {
    const initials = encodeURIComponent(this.heroInitials ?? 'CL');
    return `https://placehold.co/160x160/EFEFEF/333333?text=${initials}`;
  }

  get documentLabel(): string {
    return this.isPerson ? 'Documento de identidad' : 'NIT';
  }

  get documentValue(): string | null {
    if (this.isPerson) {
      return this.person?.nationalId != null
        ? String(this.person.nationalId)
        : null;
    }
    return this.company?.taxId != null ? String(this.company.taxId) : null;
  }

  get statusLabel(): string {
    return this.entity?.enabled ? 'Activo' : 'Inactivo';
  }

  get statusBadgeClass(): string {
    return this.entity?.enabled
      ? 'bg-success detail-status-pill-active'
      : 'bg-danger detail-status-pill-inactive';
  }

  get listLink(): (string | number)[] {
    return this.listLinks[this.clientType];
  }

  get editLink(): (string | number)[] {
    if (this.currentClientId == null) {
      return this.listLink;
    }
    return this.isPerson
      ? ['/clients/persons', this.currentClientId]
      : ['/clients/companies', this.currentClientId];
  }

  get updatePermission(): string {
    return this.isPerson ? 'person:update' : 'company:update';
  }

  get addressLine(): string {
    const address = this.entity?.address;
    if (!address) {
      return 'Sin dirección registrada';
    }
    const parts = [address.street, address.number, address.city].filter(
      (part) => !!part,
    );
    return parts.length > 0 ? parts.join(', ') : 'Sin dirección registrada';
  }

  get contactCompletion(): number {
    const entity = this.entity;
    if (!entity) {
      return 0;
    }
    const checks = [
      Boolean(entity.email),
      Boolean(entity.phoneNumber),
      Boolean(entity.address?.street),
      Boolean(entity.address?.number),
      Boolean(entity.address?.city),
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }

  get contactChecklist(): ChecklistItem[] {
    const entity = this.entity;
    if (!entity) {
      return [];
    }
    const address = entity.address;
    return [
      {
        label: 'Datos de contacto',
        description: 'Correo y teléfono registrados.',
        valid: Boolean(entity.email && entity.phoneNumber),
      },
      {
        label: 'Dirección completa',
        description: 'Calle, número y ciudad definidos.',
        valid: Boolean(address?.street && address?.number && address?.city),
      },
      {
        label: this.isPerson ? 'Documento de identidad' : 'Registro tributario',
        description: this.isPerson
          ? 'Cédula o documento equivalente diligenciado.'
          : 'NIT actualizado en el perfil.',
        valid: this.isPerson
          ? Boolean(this.person?.nationalId)
          : Boolean(this.company?.taxId),
      },
    ];
  }

  get bestContactChannel(): string {
    const entity = this.entity;
    if (entity?.email) {
      return 'Correo electrónico';
    }
    if (entity?.phoneNumber) {
      return 'Llamada telefónica';
    }
    return 'Información pendiente';
  }

  formatPhone(phone?: string | number | null): string {
    if (phone === undefined || phone === null) {
      return 'Sin teléfono registrado';
    }
    const digits = String(phone);
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return digits;
  }

  reload(): void {
    if (this.currentClientId != null) {
      this.loadClient(this.currentClientId);
    }
  }

  /**
   * Alterna el estado activo del cliente actual y, tras la operación,
   * recarga los datos para reflejar el cambio.
   */
  toggleStatus(): void {
    const entity = this.entity;
    if (!entity || this.currentClientId == null) {
      return;
    }
    const nextStatus = !entity.enabled;
    if (this.isPerson) {
      const name = this.person
        ? `${this.person.firstName} ${this.person.lastName}`.trim()
        : undefined;
      this.clientUiHelper.updatePersonStatus(
        this.currentClientId,
        nextStatus,
        () => this.reload(),
        name,
      );
    } else {
      this.clientUiHelper.updateCompanyStatus(
        this.currentClientId,
        nextStatus,
        () => this.reload(),
        this.company?.companyName,
      );
    }
  }

  /**
   * Recupera los datos del cliente según el tipo (persona/empresa) y
   * actualiza el estado de la vista manejando los estados de carga y error.
   *
   * @param id Identificador del cliente a consultar.
   */
  private loadClient(id: number): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.person = null;
    this.company = null;
    const request$: Observable<Person | Company> = this.isPerson
      ? this.personService.getById(id)
      : this.companyService.getById(id);
    request$.pipe(finalize(() => (this.isLoading = false))).subscribe({
      next: (entity: Person | Company) => {
        if (this.isPerson) {
          this.person = entity as Person;
        } else {
          this.company = entity as Company;
        }
      },
      error: () => {
        this.errorMessage =
          'No se pudo cargar la información del cliente seleccionado.';
      },
    });
  }

  private handleInvalidId(): void {
    void Swal.fire({
      icon: 'error',
      title: 'Identificador inválido',
      text: 'El identificador proporcionado no es válido para consultar el cliente.',
    });
    void this.router.navigate(this.listLink);
  }

  private normalizeType(type: unknown): ClientDetailType {
    return type === 'company' ? 'company' : 'person';
  }
}

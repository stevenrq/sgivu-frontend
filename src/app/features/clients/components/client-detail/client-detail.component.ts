import { NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, combineLatest, finalize } from 'rxjs';
import { ToastService } from '../../../../shared/services/toast.service';
import { PersonService } from '../../services/person.service';
import { CompanyService } from '../../services/company.service';
import { Person } from '../../models/person.model';
import { Company } from '../../models/company.model';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { ClientUiHelperService } from '../../../../shared/services/client-ui-helper.service';

type ClientDetailType = 'person' | 'company';

interface ChecklistItem {
  label: string;
  description: string;
  valid: boolean;
}

/**
 * Página de detalle de cliente (persona natural o empresa).
 * El tipo se determina por el dato `clientType` de la ruta (`'person'` | `'company'`).
 * Expone acciones de cambio de estado condicionadas por permisos y
 * calcula métricas de completitud del perfil del cliente.
 */
@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  styleUrls: [
    '../../../../shared/styles/entity-detail-page.css',
    './client-detail.component.css',
  ],
  imports: [NgClass, RouterLink, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly personService = inject(PersonService);
  private readonly companyService = inject(CompanyService);
  private readonly clientUiHelper = inject(ClientUiHelperService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  protected readonly clientType = signal<ClientDetailType>('person');
  protected readonly person = signal<Person | null>(null);
  protected readonly company = signal<Company | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  private currentClientId: number | null = null;

  private readonly typeLabels: Record<ClientDetailType, string> = {
    person: 'Cliente persona natural',
    company: 'Cliente empresa',
  };

  private readonly listLinks: Record<ClientDetailType, (string | number)[]> = {
    person: ['/clients/persons/page', 0],
    company: ['/clients/companies/page', 0],
  };

  protected readonly isPerson = computed(() => this.clientType() === 'person');

  protected readonly entity = computed(() =>
    this.isPerson() ? this.person() : this.company(),
  );

  protected readonly heroTitle = computed(() => {
    if (this.isPerson()) {
      const p = this.person();
      if (p) {
        return `${p.firstName} ${p.lastName}`.trim();
      }
    } else {
      const c = this.company();
      if (c) {
        return c.companyName;
      }
    }
    return this.typeLabels[this.clientType()];
  });

  protected readonly heroSubtitle = computed(() => {
    const docValue = this.documentValue() ?? 'Sin registro';
    const prefix = this.isPerson() ? 'C.C.' : 'NIT';
    return `${prefix} ${docValue} · ${this.typeLabels[this.clientType()]}`;
  });

  protected readonly clientTypeLabel = computed(
    () => this.typeLabels[this.clientType()],
  );

  protected readonly heroInitials = computed(() => {
    if (this.isPerson()) {
      const p = this.person();
      if (p) {
        const first = p.firstName?.charAt(0) ?? '';
        const last = p.lastName?.charAt(0) ?? '';
        return `${first}${last}`.toUpperCase() || 'PN';
      }
    } else {
      const c = this.company();
      if (c?.companyName) {
        const name = c.companyName.replaceAll(/[^A-Za-z0-9]/g, '');
        return name.substring(0, 2).toUpperCase() || 'EM';
      }
    }
    return this.isPerson() ? 'PN' : 'EM';
  });

  protected readonly heroImageUrl = computed(() => {
    const initials = encodeURIComponent(this.heroInitials() ?? 'CL');
    return `https://placehold.co/160x160/EFEFEF/333333?text=${initials}`;
  });

  protected readonly documentLabel = computed(() =>
    this.isPerson() ? 'Documento de identidad' : 'NIT',
  );

  protected readonly documentValue = computed(() => {
    if (this.isPerson()) {
      const nationalId = this.person()?.nationalId;
      return nationalId == null ? null : String(nationalId);
    }
    const taxId = this.company()?.taxId;
    return taxId == null ? null : String(taxId);
  });

  protected readonly statusLabel = computed(() =>
    this.entity()?.enabled ? 'Activo' : 'Inactivo',
  );

  protected readonly statusBadgeClass = computed(() =>
    this.entity()?.enabled
      ? 'bg-success detail-status-pill-active'
      : 'bg-danger detail-status-pill-inactive',
  );

  protected readonly listLink = computed(
    () => this.listLinks[this.clientType()],
  );

  protected readonly editLink = computed(() => {
    if (this.currentClientId == null) {
      return this.listLink();
    }
    return this.isPerson()
      ? ['/clients/persons', this.currentClientId]
      : ['/clients/companies', this.currentClientId];
  });

  protected readonly updatePermission = computed(() =>
    this.isPerson() ? 'person:update' : 'company:update',
  );

  protected readonly addressLine = computed(() => {
    const address = this.entity()?.address;
    if (!address) {
      return 'Sin dirección registrada';
    }
    const parts = [address.street, address.number, address.city].filter(
      (part) => !!part,
    );
    return parts.length > 0 ? parts.join(', ') : 'Sin dirección registrada';
  });

  protected readonly contactCompletion = computed(() => {
    const e = this.entity();
    if (!e) {
      return 0;
    }
    const checks = [
      Boolean(e.email),
      Boolean(e.phoneNumber),
      Boolean(e.address?.street),
      Boolean(e.address?.number),
      Boolean(e.address?.city),
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  });

  protected readonly contactChecklist = computed<ChecklistItem[]>(() => {
    const e = this.entity();
    if (!e) {
      return [];
    }
    const address = e.address;
    return [
      {
        label: 'Datos de contacto',
        description: 'Correo y teléfono registrados.',
        valid: Boolean(e.email && e.phoneNumber),
      },
      {
        label: 'Dirección completa',
        description: 'Calle, número y ciudad definidos.',
        valid: Boolean(address?.street && address?.number && address?.city),
      },
      {
        label: this.isPerson()
          ? 'Documento de identidad'
          : 'Registro tributario',
        description: this.isPerson()
          ? 'Cédula o documento equivalente diligenciado.'
          : 'NIT actualizado en el perfil.',
        valid: this.isPerson()
          ? Boolean(this.person()?.nationalId)
          : Boolean(this.company()?.taxId),
      },
    ];
  });

  protected readonly bestContactChannel = computed(() => {
    const e = this.entity();
    if (e?.email) {
      return 'Correo electrónico';
    }
    if (e?.phoneNumber) {
      return 'Llamada telefónica';
    }
    return 'Información pendiente';
  });

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.data])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, data]) => {
        this.clientType.set(this.normalizeType(data['clientType']));
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
      });
  }

  /**
   * Formatea un número de teléfono de 10 dígitos al formato `(XXX) XXX-XXXX`.
   *
   * @param phone - Número de teléfono a formatear.
   * @returns Cadena formateada, o el valor original si no tiene 10 dígitos.
   */
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

  /** Invierte el estado habilitado/deshabilitado del cliente actual tras confirmación del usuario. */
  toggleStatus(): void {
    const e = this.entity();
    if (!e || this.currentClientId == null) {
      return;
    }
    const nextStatus = !e.enabled;
    if (this.isPerson()) {
      const p = this.person();
      const name = p ? `${p.firstName} ${p.lastName}`.trim() : undefined;
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
        this.company()?.companyName,
      );
    }
  }

  private loadClient(id: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.person.set(null);
    this.company.set(null);
    const request$: Observable<Person | Company> = this.isPerson()
      ? this.personService.getById(id)
      : this.companyService.getById(id);
    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (entity: Person | Company) => {
          if (this.isPerson()) {
            this.person.set(entity as Person);
          } else {
            this.company.set(entity as Company);
          }
        },
        error: () => {
          this.errorMessage.set(
            'No se pudo cargar la información del cliente seleccionado.',
          );
        },
      });
  }

  private handleInvalidId(): void {
    this.toast.error(
      'El identificador proporcionado no es válido para consultar el cliente.',
    );
    void this.router.navigate(this.listLink());
  }

  private normalizeType(type: unknown): ClientDetailType {
    return type === 'company' ? 'company' : 'person';
  }
}

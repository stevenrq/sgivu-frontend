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
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { PersonService } from '../../services/person.service';
import { CompanyService } from '../../services/company.service';
import { FormShellComponent } from '../../../../shared/components/form-shell/form-shell.component';
import {
  lengthValidator,
  textFieldValidators,
} from '../../../../shared/validators/form.validator';
import { Person } from '../../models/person.model';
import { Company } from '../../models/company.model';
import { finalize, of, switchMap } from 'rxjs';
import {
  showErrorAlert,
  showSuccessAlert,
} from '../../../../shared/utils/swal-alert.utils';
import { showControlErrors } from '../../../../shared/utils/form.utils';
import {
  AddressFormControls,
  buildAddressFormGroup,
  normalizeAddress,
} from '../../../../shared/utils/address-form.utils';
import {
  SubmitConfig,
  SubmitCopy,
  ViewCopy,
  composeSubmitConfig,
} from '../../../../shared/models/form-config.model';

type ClientType = 'PERSON' | 'COMPANY';

interface ClientFormControls {
  type: FormControl<ClientType>;
  nationalId: FormControl<string | null>;
  firstName: FormControl<string | null>;
  lastName: FormControl<string | null>;
  taxId: FormControl<string | null>;
  companyName: FormControl<string | null>;
  phoneNumber: FormControl<string | null>;
  email: FormControl<string | null>;
  address: FormGroup<AddressFormControls>;
  enabled: FormControl<boolean>;
}

type PersonPayload = Omit<Person, 'id'> & Partial<Pick<Person, 'id'>>;
type CompanyPayload = Omit<Company, 'id'> & Partial<Pick<Company, 'id'>>;

/**
 * Formulario de creación y edición de clientes (personas naturales y empresas).
 * El tipo de cliente (`PERSON` | `COMPANY`) se determina por el dato `clientType` de la ruta
 * y controla qué campos del formulario son obligatorios.
 * Opera en modo creación o edición según la presencia del parámetro `id` en la ruta.
 */
@Component({
  selector: 'app-client-form',
  imports: [ReactiveFormsModule, NgClass, FormShellComponent],
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly personService = inject(PersonService);
  private readonly companyService = inject(CompanyService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  formGroup: FormGroup<ClientFormControls> = this.buildForm();
  readonly submitting = signal(false);
  readonly isEditMode = signal(false);
  readonly formSubmitted = signal(false);
  protected readonly showControlErrors = showControlErrors;
  private currentClientId: number | null = null;
  private currentAddressId: number | null = null;
  private initialized = false;

  readonly loading = signal(false);

  private readonly submitMessages: Record<ClientType, SubmitCopy> = {
    PERSON: {
      createSuccess: 'La persona natural fue creada exitosamente.',
      updateSuccess: 'La persona natural fue actualizada exitosamente.',
      createError: 'No se pudo crear a la persona natural. Intenta nuevamente.',
      updateError:
        'No se pudo actualizar a la persona natural. Intenta nuevamente.',
      redirectCommand: ['/clients/persons/page', 0],
    },
    COMPANY: {
      createSuccess: 'La empresa fue creada exitosamente.',
      updateSuccess: 'La empresa fue actualizada exitosamente.',
      createError: 'No se pudo crear la empresa. Intenta nuevamente.',
      updateError: 'No se pudo actualizar la empresa. Intenta nuevamente.',
      redirectCommand: ['/clients/companies/page', 0],
    },
  };

  private readonly viewCopyMap: Record<ClientType, ViewCopy> = {
    PERSON: {
      createTitle: 'Crear Cliente Persona Natural',
      editTitle: 'Editar Cliente Persona Natural',
      createSubtitle:
        'Completa la información para registrar una nueva persona natural.',
      editSubtitle: 'Actualiza los datos de la persona natural seleccionada.',
    },
    COMPANY: {
      createTitle: 'Crear Cliente Empresa',
      editTitle: 'Editar Cliente Empresa',
      createSubtitle:
        'Completa la información para registrar una nueva empresa.',
      editSubtitle: 'Actualiza los datos de la empresa seleccionada.',
    },
  };

  get clientType(): ClientType {
    return this.formGroup.controls.type.getRawValue();
  }

  readonly headerIcon = computed(() => {
    if (this.isEditMode()) return 'bi-pencil-square';
    return this.clientType === 'PERSON'
      ? 'bi-person-plus-fill'
      : 'bi-building-add';
  });

  readonly titleText = computed(() => {
    const copy = this.viewCopyMap[this.clientType];
    return this.isEditMode() ? copy.editTitle : copy.createTitle;
  });

  readonly subtitleText = computed(() => {
    const copy = this.viewCopyMap[this.clientType];
    return this.isEditMode() ? copy.editSubtitle : copy.createSubtitle;
  });

  ngOnInit(): void {
    const initialType = this.extractClientTypeFromRoute();
    this.formGroup.controls.type.setValue(initialType, { emitEvent: false });
    this.applyTypeSpecificSetup(initialType);

    this.formGroup.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => {
        if (type && !this.isEditMode()) {
          this.applyTypeSpecificSetup(type);
          this.formSubmitted.set(false);
        }
      });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (this.isEditMode()) return;
        const queryType = this.normalizeType(params.get('type'));
        if (queryType !== this.formGroup.controls.type.value) {
          this.formGroup.controls.type.setValue(queryType);
        }
      });

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const idParam = params.get('id');
          if (!idParam) {
            this.resetToCreateMode();
            return of(null);
          }

          const id = Number(idParam);
          if (Number.isNaN(id)) {
            void showErrorAlert('El identificador proporcionado no es válido.');
            void this.router.navigate(['/clients']);
            return of(null);
          }

          this.isEditMode.set(true);
          this.currentClientId = id;
          this.formGroup.controls.type.disable({ emitEvent: false });
          const hintedType = this.extractClientTypeFromRoute();
          return of({ id, hintedType });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        if (!data || this.initialized) return;
        this.initialized = true;
        this.loadClientForEdit(data.id, data.hintedType);
      });
  }

  protected onSubmit(): void {
    this.formSubmitted.set(true);
    if (this.formGroup.invalid) {
      return;
    }

    this.submitting.set(true);
    const { request$, successMessage, errorMessage, redirectCommand } =
      this.buildSubmitConfig();

    request$
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          void showSuccessAlert(successMessage);
          void this.router.navigate(redirectCommand);
        },
        error: () => {
          void showErrorAlert(errorMessage);
        },
      });
  }

  protected onCancel(): void {
    void this.router.navigate(this.getRedirectCommand(this.clientType));
  }

  private buildSubmitConfig(): SubmitConfig {
    if (this.clientType === 'PERSON') {
      const payload = this.buildPersonPayload();
      const request$ =
        this.isEditMode() && this.currentClientId
          ? this.personService.update(this.currentClientId, payload as Person)
          : this.personService.create(payload as Person);
      return composeSubmitConfig(
        this.submitMessages['PERSON'],
        request$,
        this.isEditMode(),
      );
    }

    const payload = this.buildCompanyPayload();
    const request$ =
      this.isEditMode() && this.currentClientId
        ? this.companyService.update(this.currentClientId, payload as Company)
        : this.companyService.create(payload as Company);
    return composeSubmitConfig(
      this.submitMessages['COMPANY'],
      request$,
      this.isEditMode(),
    );
  }

  private getRedirectCommand(type: ClientType): (string | number)[] {
    return [...this.submitMessages[type].redirectCommand];
  }

  private buildForm(): FormGroup<ClientFormControls> {
    return this.formBuilder.group({
      type: new FormControl<ClientType>('PERSON', { nonNullable: true }),
      nationalId: new FormControl<string | null>(null),
      firstName: new FormControl<string | null>(''),
      lastName: new FormControl<string | null>(''),
      taxId: new FormControl<string | null>(null),
      companyName: new FormControl<string | null>(''),
      phoneNumber: new FormControl<string | null>('', [
        Validators.required,
        Validators.pattern(/^\d+$/),
        lengthValidator(10, 10),
      ]),
      email: new FormControl<string | null>('', [
        Validators.required,
        Validators.email,
        lengthValidator(6, 80),
      ]),
      address: buildAddressFormGroup(this.formBuilder),
      enabled: new FormControl<boolean>(true, { nonNullable: true }),
    });
  }

  private applyTypeSpecificSetup(type: ClientType): void {
    if (type === 'PERSON') {
      this.enablePersonControls();
      this.disableCompanyControls();
    } else {
      this.enableCompanyControls();
      this.disablePersonControls();
    }
  }

  private enablePersonControls(): void {
    const { nationalId, firstName, lastName } = this.formGroup.controls;
    nationalId.setValidators([
      Validators.required,
      Validators.pattern(/^\d+$/),
      lengthValidator(7, 10),
    ]);
    firstName.setValidators(textFieldValidators(3, 30));
    lastName.setValidators(textFieldValidators(3, 40));

    nationalId.enable({ emitEvent: false });
    firstName.enable({ emitEvent: false });
    lastName.enable({ emitEvent: false });

    nationalId.updateValueAndValidity({ emitEvent: false });
    firstName.updateValueAndValidity({ emitEvent: false });
    lastName.updateValueAndValidity({ emitEvent: false });
  }

  private disablePersonControls(): void {
    const { nationalId, firstName, lastName } = this.formGroup.controls;
    nationalId.reset(null, { emitEvent: false });
    firstName.reset('', { emitEvent: false });
    lastName.reset('', { emitEvent: false });

    nationalId.clearValidators();
    firstName.clearValidators();
    lastName.clearValidators();

    nationalId.disable({ emitEvent: false });
    firstName.disable({ emitEvent: false });
    lastName.disable({ emitEvent: false });
  }

  private enableCompanyControls(): void {
    const { taxId, companyName } = this.formGroup.controls;
    taxId.setValidators([
      Validators.required,
      Validators.pattern(/^\d+$/),
      lengthValidator(10, 13),
    ]);
    companyName.setValidators(textFieldValidators(3, 60));

    taxId.enable({ emitEvent: false });
    companyName.enable({ emitEvent: false });

    taxId.updateValueAndValidity({ emitEvent: false });
    companyName.updateValueAndValidity({ emitEvent: false });
  }

  private disableCompanyControls(): void {
    const { taxId, companyName } = this.formGroup.controls;
    taxId.reset(null, { emitEvent: false });
    companyName.reset('', { emitEvent: false });

    taxId.clearValidators();
    companyName.clearValidators();

    taxId.disable({ emitEvent: false });
    companyName.disable({ emitEvent: false });
  }

  private buildPersonPayload(): PersonPayload {
    const { nationalId, firstName, lastName, phoneNumber, email, enabled } =
      this.formGroup.getRawValue();

    const payload: PersonPayload = {
      nationalId: Number(nationalId),
      firstName: firstName?.trim() ?? '',
      lastName: lastName?.trim() ?? '',
      phoneNumber: phoneNumber ?? '',
      email: email?.trim() ?? '',
      enabled,
      address: normalizeAddress(
        this.formGroup.controls.address,
        this.isEditMode() ? this.currentAddressId : null,
      ),
    };

    if (this.isEditMode() && this.currentClientId) {
      payload.id = this.currentClientId;
    }

    return payload;
  }

  private buildCompanyPayload(): CompanyPayload {
    const { taxId, companyName, phoneNumber, email, enabled } =
      this.formGroup.getRawValue();

    const payload: CompanyPayload = {
      taxId: Number(taxId),
      companyName: companyName?.trim() ?? '',
      phoneNumber: phoneNumber ?? '',
      email: email?.trim() ?? '',
      enabled,
      address: normalizeAddress(
        this.formGroup.controls.address,
        this.isEditMode() ? this.currentAddressId : null,
      ),
    };

    if (this.isEditMode() && this.currentClientId) {
      payload.id = this.currentClientId;
    }

    return payload;
  }

  private extractClientTypeFromRoute(): ClientType {
    const snapshotData = this.route.snapshot.data?.['clientType'] as
      | string
      | undefined;
    const snapshotParam = this.route.snapshot.paramMap.get('type');
    const queryParam = this.route.snapshot.queryParamMap.get('type');
    return this.normalizeType(snapshotParam ?? snapshotData ?? queryParam);
  }

  private normalizeType(value: string | null | undefined): ClientType {
    if (!value) return 'PERSON';
    return value.toUpperCase() === 'COMPANY' ? 'COMPANY' : 'PERSON';
  }

  private loadClientForEdit(id: number, hintedType: ClientType): void {
    this.loading.set(true);

    if (hintedType === 'PERSON') {
      this.personService
        .getById(id)
        .pipe(
          finalize(() => this.loading.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (person) => this.populatePerson(person),
          error: () => this.attemptCompanyFallback(id),
        });
      return;
    }

    if (hintedType === 'COMPANY') {
      this.companyService
        .getById(id)
        .pipe(
          finalize(() => this.loading.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (company) => this.populateCompany(company),
          error: () => this.attemptPersonFallback(id),
        });
      return;
    }

    this.loading.set(false);
  }

  private attemptCompanyFallback(id: number): void {
    this.companyService
      .getById(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (company) => {
          this.formGroup.controls.type.setValue('COMPANY', {
            emitEvent: false,
          });
          this.populateCompany(company);
        },
        error: () => {
          void showErrorAlert(
            'No se encontró información del cliente solicitado.',
          );
          void this.router.navigate(['/clients']);
        },
      });
  }

  private attemptPersonFallback(id: number): void {
    this.personService
      .getById(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (person) => {
          this.formGroup.controls.type.setValue('PERSON', {
            emitEvent: false,
          });
          this.populatePerson(person);
        },
        error: () => {
          void showErrorAlert(
            'No se encontró información del cliente solicitado.',
          );
          void this.router.navigate(['/clients']);
        },
      });
  }

  private populatePerson(person: Person): void {
    this.currentAddressId = person.address?.id ?? null;
    this.applyTypeSpecificSetup('PERSON');
    this.formGroup.controls.type.setValue('PERSON', { emitEvent: false });
    this.formGroup.controls.type.disable({ emitEvent: false });
    this.formGroup.patchValue({
      nationalId: person.nationalId?.toString() ?? '',
      firstName: person.firstName ?? '',
      lastName: person.lastName ?? '',
      phoneNumber: person.phoneNumber ?? '',
      email: person.email ?? '',
      address: {
        street: person.address?.street ?? '',
        number: person.address?.number ?? '',
        city: person.address?.city ?? '',
      },
      enabled: person.enabled ?? true,
    });
  }

  private populateCompany(company: Company): void {
    this.currentAddressId = company.address?.id ?? null;
    this.applyTypeSpecificSetup('COMPANY');
    this.formGroup.controls.type.setValue('COMPANY', { emitEvent: false });
    this.formGroup.controls.type.disable({ emitEvent: false });
    this.formGroup.patchValue({
      taxId: company.taxId?.toString() ?? '',
      companyName: company.companyName ?? '',
      phoneNumber: company.phoneNumber ?? '',
      email: company.email ?? '',
      address: {
        street: company.address?.street ?? '',
        number: company.address?.number ?? '',
        city: company.address?.city ?? '',
      },
      enabled: company.enabled ?? true,
    });
  }

  private resetToCreateMode(): void {
    this.isEditMode.set(false);
    this.currentClientId = null;
    this.currentAddressId = null;
    this.formGroup.controls.type.enable({ emitEvent: false });
    this.initialized = true;
    this.formSubmitted.set(false);
    const type = this.extractClientTypeFromRoute();
    this.formGroup.controls.type.setValue(type, { emitEvent: false });
    this.applyTypeSpecificSetup(type);
  }
}

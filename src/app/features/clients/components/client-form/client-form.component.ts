import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
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
import {
  lengthValidator,
  noWhitespaceValidator,
} from '../../../../shared/validators/form.validator';
import { Address } from '../../../../shared/models/address.model';
import { Person } from '../../models/person.model.';
import { Company } from '../../models/company.model';
import { finalize, of, switchMap, Observable, Subscription } from 'rxjs';
import Swal from 'sweetalert2';

type ClientType = 'PERSON' | 'COMPANY';

interface AddressFormControls {
  street: FormControl<string | null>;
  number: FormControl<string | null>;
  city: FormControl<string | null>;
}

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

interface SubmitConfig {
  request$: Observable<unknown>;
  successMessage: string;
  errorMessage: string;
  redirectCommand: Array<string | number>;
}

interface SubmitCopy {
  createSuccess: string;
  updateSuccess: string;
  createError: string;
  updateError: string;
  redirectCommand: Array<string | number>;
}

interface ViewCopy {
  createTitle: string;
  editTitle: string;
  createSubtitle: string;
  editSubtitle: string;
}

@Component({
  selector: 'app-client-form',
  imports: [ReactiveFormsModule, NgClass],
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.css',
})
export class ClientFormComponent implements OnInit, OnDestroy {
  formGroup: FormGroup<ClientFormControls>;
  isSubmitting = false;
  isEditMode = false;
  private currentClientId: number | null = null;
  private currentAddressId: number | null = null;
  private initialized = false;

  private readonly loadingSignal = signal<boolean>(false);
  readonly isLoading = computed(() => this.loadingSignal());

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

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly personService: PersonService,
    private readonly companyService: CompanyService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.formGroup = this.buildForm();
  }

  ngOnInit(): void {
    const initialType = this.extractClientTypeFromRoute();
    this.typeControl.setValue(initialType, { emitEvent: false });
    this.applyTypeSpecificSetup(initialType);

    const typeSub = this.typeControl.valueChanges.subscribe((type) => {
      if (type && !this.isEditMode) {
        this.applyTypeSpecificSetup(type);
      }
    });

    const querySub = this.route.queryParamMap.subscribe((params) => {
      if (this.isEditMode) return;
      const queryType = this.normalizeType(params.get('type'));
      if (queryType !== this.typeControl.value) {
        this.typeControl.setValue(queryType);
      }
    });

    const paramsSub = this.route.paramMap
      .pipe(
        switchMap((params) => {
          const idParam = params.get('id');
          if (!idParam) {
            this.resetToCreateMode();
            return of(null);
          }

          const id = Number(idParam);
          if (Number.isNaN(id)) {
            this.showErrorAlert('El identificador proporcionado no es válido.');
            void this.router.navigate(['/clients']);
            return of(null);
          }

          this.isEditMode = true;
          this.currentClientId = id;
          this.typeControl.disable({ emitEvent: false });
          const hintedType = this.extractClientTypeFromRoute();
          return of({ id, hintedType });
        }),
      )
      .subscribe((data) => {
        if (!data || this.initialized) {
          return;
        }

        this.initialized = true;
        this.loadClientForEdit(data.id, data.hintedType);
      });

    this.subscriptions.push(typeSub, querySub, paramsSub);
  }

  ngOnDestroy(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  get clientType(): ClientType {
    return this.typeControl.getRawValue();
  }

  get typeControl(): FormControl<ClientType> {
    return this.formGroup.get('type') as FormControl<ClientType>;
  }

  get nationalId() {
    return this.formGroup.get('nationalId');
  }

  get firstName() {
    return this.formGroup.get('firstName');
  }

  get lastName() {
    return this.formGroup.get('lastName');
  }

  get taxId() {
    return this.formGroup.get('taxId');
  }

  get companyName() {
    return this.formGroup.get('companyName');
  }

  get phoneNumber() {
    return this.formGroup.get('phoneNumber');
  }

  get email() {
    return this.formGroup.get('email');
  }

  get addressGroup(): FormGroup<AddressFormControls> | null {
    return this.formGroup.get('address') as FormGroup<AddressFormControls>;
  }

  get street() {
    return this.addressGroup?.get('street');
  }

  get number() {
    return this.addressGroup?.get('number');
  }

  get city() {
    return this.addressGroup?.get('city');
  }

  get enabled() {
    return this.formGroup.get('enabled');
  }

  get headerIcon(): string {
    if (this.isEditMode) {
      return 'bi-pencil-square';
    }
    return this.clientType === 'PERSON'
      ? 'bi-person-plus-fill'
      : 'bi-building-add';
  }

  get titleText(): string {
    const copy = this.getViewCopy(this.clientType);
    return this.isEditMode ? copy.editTitle : copy.createTitle;
  }

  get subtitleText(): string {
    const copy = this.getViewCopy(this.clientType);
    return this.isEditMode ? copy.editSubtitle : copy.createSubtitle;
  }

  protected onSubmit(): void {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const { request$, successMessage, errorMessage, redirectCommand } =
      this.buildSubmitConfig();

    request$.pipe(finalize(() => (this.isSubmitting = false))).subscribe({
      next: () => {
        this.showSuccessAlert(successMessage);
        void this.router.navigate(redirectCommand);
      },
      error: () => {
        this.showErrorAlert(errorMessage);
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
        this.isEditMode && this.currentClientId
          ? this.personService.update(this.currentClientId, payload as Person)
          : this.personService.create(payload as Person);

      return this.composeSubmitConfig('PERSON', request$);
    }

    const payload = this.buildCompanyPayload();
    const request$ =
      this.isEditMode && this.currentClientId
        ? this.companyService.update(this.currentClientId, payload as Company)
        : this.companyService.create(payload as Company);

    return this.composeSubmitConfig('COMPANY', request$);
  }

  private composeSubmitConfig(
    type: ClientType,
    request$: Observable<unknown>,
  ): SubmitConfig {
    const copy = this.getSubmitCopy(type);
    return {
      request$,
      successMessage: this.isEditMode ? copy.updateSuccess : copy.createSuccess,
      errorMessage: this.isEditMode ? copy.updateError : copy.createError,
      redirectCommand: this.getRedirectCommand(type),
    };
  }

  private getSubmitCopy(type: ClientType): SubmitCopy {
    return this.submitMessages[type];
  }

  private getRedirectCommand(type: ClientType): Array<string | number> {
    return [...this.getSubmitCopy(type).redirectCommand];
  }

  private getViewCopy(type: ClientType): ViewCopy {
    return this.viewCopyMap[type];
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
      address: this.formBuilder.group<AddressFormControls>({
        street: new FormControl<string | null>('', [
          Validators.required,
          lengthValidator(5, 80),
          noWhitespaceValidator(),
        ]),
        number: new FormControl<string | null>('', [
          Validators.required,
          lengthValidator(1, 10),
          noWhitespaceValidator(),
        ]),
        city: new FormControl<string | null>('', [
          Validators.required,
          lengthValidator(3, 60),
          noWhitespaceValidator(),
        ]),
      }),
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
    this.nationalId?.setValidators([
      Validators.required,
      Validators.pattern(/^\d+$/),
      lengthValidator(7, 10),
    ]);
    this.firstName?.setValidators([
      Validators.required,
      lengthValidator(3, 30),
      noWhitespaceValidator(),
    ]);
    this.lastName?.setValidators([
      Validators.required,
      lengthValidator(3, 40),
      noWhitespaceValidator(),
    ]);

    this.nationalId?.enable({ emitEvent: false });
    this.firstName?.enable({ emitEvent: false });
    this.lastName?.enable({ emitEvent: false });

    this.nationalId?.updateValueAndValidity({ emitEvent: false });
    this.firstName?.updateValueAndValidity({ emitEvent: false });
    this.lastName?.updateValueAndValidity({ emitEvent: false });
  }

  private disablePersonControls(): void {
    this.nationalId?.reset(null, { emitEvent: false });
    this.firstName?.reset('', { emitEvent: false });
    this.lastName?.reset('', { emitEvent: false });

    this.nationalId?.clearValidators();
    this.firstName?.clearValidators();
    this.lastName?.clearValidators();

    this.nationalId?.disable({ emitEvent: false });
    this.firstName?.disable({ emitEvent: false });
    this.lastName?.disable({ emitEvent: false });
  }

  private enableCompanyControls(): void {
    this.taxId?.setValidators([
      Validators.required,
      Validators.pattern(/^\d+$/),
      lengthValidator(10, 13),
    ]);
    this.companyName?.setValidators([
      Validators.required,
      lengthValidator(3, 60),
      noWhitespaceValidator(),
    ]);

    this.taxId?.enable({ emitEvent: false });
    this.companyName?.enable({ emitEvent: false });

    this.taxId?.updateValueAndValidity({ emitEvent: false });
    this.companyName?.updateValueAndValidity({ emitEvent: false });
  }

  private disableCompanyControls(): void {
    this.taxId?.reset(null, { emitEvent: false });
    this.companyName?.reset('', { emitEvent: false });

    this.taxId?.clearValidators();
    this.companyName?.clearValidators();

    this.taxId?.disable({ emitEvent: false });
    this.companyName?.disable({ emitEvent: false });
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
      address: this.normalizeAddress(),
    };

    if (this.isEditMode && this.currentClientId) {
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
      address: this.normalizeAddress(),
    };

    if (this.isEditMode && this.currentClientId) {
      payload.id = this.currentClientId;
    }

    return payload;
  }

  private normalizeAddress(): Address {
    const addressGroupValue = this.addressGroup?.getRawValue() ?? {
      street: '',
      number: '',
      city: '',
    };

    const address: Address = {
      street: addressGroupValue.street?.trim() ?? '',
      number: addressGroupValue.number?.trim() ?? '',
      city: addressGroupValue.city?.trim() ?? '',
    };

    if (this.isEditMode && this.currentAddressId != null) {
      address.id = this.currentAddressId;
    }

    return address;
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
    if (!value) {
      return 'PERSON';
    }
    return value.toUpperCase() === 'COMPANY' ? 'COMPANY' : 'PERSON';
  }

  private loadClientForEdit(id: number, hintedType: ClientType): void {
    this.loadingSignal.set(true);

    if (hintedType === 'PERSON') {
      this.personService
        .getById(id)
        .pipe(finalize(() => this.loadingSignal.set(false)))
        .subscribe({
          next: (person) => this.populatePerson(person),
          error: () => this.attemptCompanyFallback(id),
        });
      return;
    }

    if (hintedType === 'COMPANY') {
      this.companyService
        .getById(id)
        .pipe(finalize(() => this.loadingSignal.set(false)))
        .subscribe({
          next: (company) => this.populateCompany(company),
          error: () => this.attemptPersonFallback(id),
        });
      return;
    }

    this.loadingSignal.set(false);
  }

  private attemptCompanyFallback(id: number): void {
    this.companyService
      .getById(id)
      .pipe(finalize(() => this.loadingSignal.set(false)))
      .subscribe({
        next: (company) => {
          this.typeControl.setValue('COMPANY', { emitEvent: false });
          this.populateCompany(company);
        },
        error: () => {
          this.showErrorAlert(
            'No se encontró información del cliente solicitado.',
          );
          void this.router.navigate(['/clients']);
        },
      });
  }

  private attemptPersonFallback(id: number): void {
    this.personService
      .getById(id)
      .pipe(finalize(() => this.loadingSignal.set(false)))
      .subscribe({
        next: (person) => {
          this.typeControl.setValue('PERSON', { emitEvent: false });
          this.populatePerson(person);
        },
        error: () => {
          this.showErrorAlert(
            'No se encontró información del cliente solicitado.',
          );
          void this.router.navigate(['/clients']);
        },
      });
  }

  private populatePerson(person: Person): void {
    this.currentAddressId = person.address?.id ?? null;
    this.applyTypeSpecificSetup('PERSON');
    this.typeControl.setValue('PERSON', { emitEvent: false });
    this.typeControl.disable({ emitEvent: false });
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
    this.typeControl.setValue('COMPANY', { emitEvent: false });
    this.typeControl.disable({ emitEvent: false });
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
    this.isEditMode = false;
    this.currentClientId = null;
    this.currentAddressId = null;
    this.typeControl.enable({ emitEvent: false });
    this.initialized = true;
    const type = this.extractClientTypeFromRoute();
    this.typeControl.setValue(type, { emitEvent: false });
    this.applyTypeSpecificSetup(type);
  }

  private showSuccessAlert(message: string): void {
    void Swal.fire({
      icon: 'success',
      title: 'Operación exitosa',
      text: message,
      confirmButtonColor: '#0d6efd',
    });
  }

  private showErrorAlert(message: string): void {
    void Swal.fire({
      icon: 'error',
      title: 'Ha ocurrido un error',
      text: message,
      confirmButtonColor: '#d33',
    });
  }
}

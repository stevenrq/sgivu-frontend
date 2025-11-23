import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, finalize } from 'rxjs';
import Swal from 'sweetalert2';
import { FormShellComponent } from '../../../../shared/components/form-shell/form-shell.component';
import {
  lengthValidator,
  noSpecialCharactersValidator,
  passwordStrengthValidator,
} from '../../../../shared/validators/form.validator';
import { Address } from '../../../../shared/models/address.model';
import { User } from '../../models/user.model';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../auth/services/auth.service';

interface AddressFormControls {
  street: FormControl<string | null>;
  number: FormControl<string | null>;
  city: FormControl<string | null>;
}

interface UserFormControls {
  nationalId: FormControl<string | null>;
  firstName: FormControl<string | null>;
  lastName: FormControl<string | null>;
  phoneNumber: FormControl<string | null>;
  email: FormControl<string | null>;
  address: FormGroup<AddressFormControls>;
  username: FormControl<string | null>;
  password: FormControl<string | null>;
}

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
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, NgClass, FormShellComponent],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.css',
})
/**
 * Gestiona la creación y edición de usuarios, incluyendo dirección anidada,
 * alternancia entre modos (autoedición vs. administración) y reglas dinámicas
 * para el campo de contraseña según el contexto.
 */
export class UserFormComponent implements OnInit, OnDestroy {
  formGroup: FormGroup<UserFormControls>;
  showPassword = false;
  isEditMode = false;
  isSubmitting = false;

  private currentUserId: number | null = null;
  private currentAddressId: number | null = null;

  private readonly loadingSignal = signal<boolean>(false);
  readonly isLoading = computed(() => this.loadingSignal());

  private readonly submitCopy: SubmitCopy = {
    createSuccess: 'El usuario fue registrado exitosamente.',
    updateSuccess: 'La información del usuario fue actualizada exitosamente.',
    createError:
      'No se pudo registrar el usuario. Intenta nuevamente en unos momentos.',
    updateError:
      'No se pudo actualizar el usuario. Intenta nuevamente en unos momentos.',
    redirectCommand: ['/users/page', 0],
  };

  private readonly viewCopy: ViewCopy = {
    createTitle: 'Crear Nuevo Usuario',
    editTitle: 'Editar Usuario',
    createSubtitle:
      'Completa el formulario para registrar un nuevo usuario en el sistema.',
    editSubtitle: 'Modifica los datos del usuario seleccionado.',
  };

  private readonly initialValue = {
    nationalId: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    address: {
      street: '',
      number: '',
      city: '',
    },
    username: '',
    password: '',
  };

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly userService: UserService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
  ) {
    this.formGroup = this.buildForm();
  }

  ngOnInit(): void {
    this.configurePasswordWatcher();
    const isSelfEdit = this.route.snapshot.data?.['selfEdit'] === true;

    const paramsSub = this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (idParam) {
        const id = Number(idParam);
        if (Number.isNaN(id)) {
          this.showErrorAlert('El identificador proporcionado no es válido.');
          void this.router.navigate(['/users/page', 0]);
          return;
        }

        this.activateEditMode(id);
        return;
      }

      if (isSelfEdit) {
        const currentUserId = this.authService.getUserId();
        if (currentUserId != null) {
          this.activateEditMode(currentUserId);
          return;
        }

        this.showErrorAlert('No se pudo identificar al usuario actual.');
        void this.router.navigate(['/login']);
        return;
      }

      this.resetToCreateMode();
    });

    this.subscriptions.push(paramsSub);
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
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

  get phoneNumber() {
    return this.formGroup.get('phoneNumber');
  }

  get email() {
    return this.formGroup.get('email');
  }

  get username() {
    return this.formGroup.get('username');
  }

  get password() {
    return this.formGroup.get('password');
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

  get headerIcon(): string {
    return this.isEditMode ? 'bi-pencil-square' : 'bi-person-plus-fill';
  }

  get titleText(): string {
    return this.isEditMode
      ? this.viewCopy.editTitle
      : this.viewCopy.createTitle;
  }

  get subtitleText(): string {
    return this.isEditMode
      ? this.viewCopy.editSubtitle
      : this.viewCopy.createSubtitle;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  protected onSubmit(): void {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    const { request$, successMessage, errorMessage, redirectCommand } =
      this.buildSubmitConfig();

    this.isSubmitting = true;

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
    void this.router.navigate(this.submitCopy.redirectCommand);
  }

  private buildForm(): FormGroup<UserFormControls> {
    return this.formBuilder.group({
      nationalId: new FormControl<string | null>('', [
        Validators.required,
        Validators.pattern(/^\d+$/),
        lengthValidator(7, 10),
      ]),
      firstName: new FormControl<string | null>('', [
        Validators.required,
        lengthValidator(3, 20),
      ]),
      lastName: new FormControl<string | null>('', [
        Validators.required,
        lengthValidator(3, 20),
      ]),
      phoneNumber: new FormControl<string | null>('', [
        Validators.required,
        Validators.pattern(/^\d+$/),
        lengthValidator(10, 10),
      ]),
      email: new FormControl<string | null>('', [
        Validators.required,
        Validators.email,
        lengthValidator(16, 40),
      ]),
      address: this.formBuilder.group<AddressFormControls>({
        street: new FormControl<string | null>('', [
          Validators.required,
          lengthValidator(5, 50),
        ]),
        number: new FormControl<string | null>('', [
          Validators.required,
          lengthValidator(1, 10),
        ]),
        city: new FormControl<string | null>('', [
          Validators.required,
          lengthValidator(4, 30),
        ]),
      }),
      username: new FormControl<string | null>('', [
        Validators.required,
        lengthValidator(6, 20),
        noSpecialCharactersValidator(),
      ]),
      password: new FormControl<string | null>('', [
        Validators.required,
        lengthValidator(6, 20),
        passwordStrengthValidator(),
      ]),
    });
  }

  /**
   * Ajusta dinámicamente las validaciones de contraseña. En modo edición permite
   * dejar el campo vacío para conservar el valor actual, pero exige los
   * validadores si el usuario escribe algo.
   */
  private configurePasswordWatcher(): void {
    const passwordControl = this.password;
    if (!passwordControl) {
      return;
    }

    const sub = passwordControl.valueChanges.subscribe((value) => {
      if (!this.isEditMode) {
        return;
      }

      if (value) {
        passwordControl.setValidators([
          lengthValidator(6, 20),
          passwordStrengthValidator(),
        ]);
      } else {
        passwordControl.clearValidators();
      }

      passwordControl.updateValueAndValidity({ emitEvent: false });
    });

    this.subscriptions.push(sub);
  }

  /**
   * Cambia el formulario a modo edición, aplicando reglas de contraseña,
   * guardando el id actual y cargando la información del usuario.
   *
   * @param id - Identificador del usuario a editar.
   */
  private activateEditMode(id: number): void {
    if (this.currentUserId === id && this.isEditMode) {
      return;
    }

    this.isEditMode = true;
    this.currentUserId = id;
    this.applyEditPasswordBehaviour();
    this.loadUserForEdit(id);
  }

  /**
   * Obtiene los datos del usuario desde la API, rellena el formulario y maneja
   * el estado de carga/errores cuando no se encuentra la información.
   *
   * @param id - Identificador del usuario que se va a editar.
   */
  private loadUserForEdit(id: number): void {
    this.loadingSignal.set(true);

    const sub = this.userService
      .getById(id)
      .pipe(finalize(() => this.loadingSignal.set(false)))
      .subscribe({
        next: (user) => {
          this.currentAddressId = user.address?.id ?? null;
          this.formGroup.patchValue({
            nationalId: user.nationalId?.toString() ?? '',
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
            phoneNumber: user.phoneNumber?.toString() ?? '',
            email: user.email ?? '',
            address: {
              street: user.address?.street ?? '',
              number: user.address?.number ?? '',
              city: user.address?.city ?? '',
            },
            username: user.username ?? '',
            password: '',
          });
          this.formGroup.markAsPristine();
          this.formGroup.markAsUntouched();
        },
        error: () => {
          this.showErrorAlert(
            'No se pudo cargar la información del usuario solicitado.',
          );
          void this.router.navigate(this.submitCopy.redirectCommand);
        },
      });

    this.subscriptions.push(sub);
  }

  /**
   * Restaura el formulario a su estado inicial para crear usuarios nuevos,
   * reactivando los validadores obligatorios y limpiando ids previos.
   */
  private resetToCreateMode(): void {
    this.isEditMode = false;
    this.currentUserId = null;
    this.currentAddressId = null;
    this.formGroup.reset(this.initialValue);
    this.applyCreatePasswordBehaviour();
    this.formGroup.markAsPristine();
    this.formGroup.markAsUntouched();
  }

  /**
   * Limpia el campo de contraseña y elimina los validadores para que las
   * ediciones no obliguen a asignar una nueva clave.
   */
  private applyEditPasswordBehaviour(): void {
    this.password?.setValue('', { emitEvent: false });
    this.password?.clearValidators();
    this.password?.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Reasigna los validadores estrictos de contraseña cuando el formulario vuelve
   * al modo de creación.
   */
  private applyCreatePasswordBehaviour(): void {
    this.password?.setValidators([
      Validators.required,
      lengthValidator(6, 20),
      passwordStrengthValidator(),
    ]);
    this.password?.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Genera la configuración necesaria para enviar el formulario, seleccionando
   * entre crear o actualizar y resolviendo los mensajes de feedback.
   *
   * @returns Configuración con observable de la petición y textos para la UI.
   */
  private buildSubmitConfig(): SubmitConfig {
    const payload = this.buildUserPayload();

    const request$ =
      this.isEditMode && this.currentUserId != null
        ? this.userService.update(this.currentUserId, payload as User)
        : this.userService.create(payload as User);

    return {
      request$,
      successMessage: this.isEditMode
        ? this.submitCopy.updateSuccess
        : this.submitCopy.createSuccess,
      errorMessage: this.isEditMode
        ? this.submitCopy.updateError
        : this.submitCopy.createError,
      redirectCommand: [...this.submitCopy.redirectCommand],
    };
  }

  /**
   * Normaliza el formulario y construye el payload que espera el backend.
   * Incluye trims, cast numéricos y eliminación condicional de la contraseña.
   *
   * @returns Objeto listo para enviarse al servicio de usuarios.
   */
  private buildUserPayload(): Partial<User> {
    const raw = this.formGroup.getRawValue();
    const payload: Partial<User> = {
      nationalId: this.toNumber(raw.nationalId),
      firstName: raw.firstName?.trim() ?? '',
      lastName: raw.lastName?.trim() ?? '',
      phoneNumber: this.toNumber(raw.phoneNumber),
      email: raw.email?.trim() ?? '',
      username: raw.username?.trim().toLowerCase() ?? '',
      password: raw.password?.trim() || undefined,
      address: this.normalizeAddress(),
    };

    if (!payload.password) {
      delete payload.password;
    }

    if (this.isEditMode && this.currentUserId != null) {
      payload.id = this.currentUserId;
    }

    return payload;
  }

  /**
   * Extrae la dirección embebida, aplica trims y agrega el `id` cuando se
   * edita, manteniendo la compatibilidad con la API.
   *
   * @returns Dirección normalizada que se adjunta al payload del usuario.
   */
  private normalizeAddress(): Address {
    const addressGroup = this.addressGroup?.getRawValue() ?? {
      street: '',
      number: '',
      city: '',
    };

    const address: Address = {
      street: addressGroup.street?.trim() ?? '',
      number: addressGroup.number?.trim() ?? '',
      city: addressGroup.city?.trim() ?? '',
    };

    if (this.isEditMode && this.currentAddressId != null) {
      address.id = this.currentAddressId;
    }

    return address;
  }

  private toNumber(value: string | null | undefined): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
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

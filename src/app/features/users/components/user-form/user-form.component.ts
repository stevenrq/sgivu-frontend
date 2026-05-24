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
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { FormShellComponent } from '../../../../shared/components/form-shell/form-shell.component';
import {
  lengthValidator,
  noSpecialCharactersValidator,
  passwordStrengthValidator,
} from '../../../../shared/validators/form.validator';
import { User } from '../../models/user.model';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../auth/services/auth.service';
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
import { RoleService } from '../../../auth/services/role.service';
import { Role } from '../../../../shared/models/role.model';

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

/**
 * Formulario de creación y edición de usuarios.
 * Opera en modo creación (sin parámetro `id`) o modo edición (con `id` en ruta o flag `selfEdit`).
 * En modo edición, la contraseña es opcional: solo se envía si el usuario la modifica.
 *
 * @remarks
 * El flag `selfEdit` en `route.data` habilita al usuario actual editar su propio perfil
 * sin necesidad de pasar el `id` por la URL.
 */
@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, NgClass, FormShellComponent],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roleService = inject(RoleService);

  formGroup: FormGroup<UserFormControls> = this.buildForm();
  readonly showPassword = signal(false);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);
  readonly formSubmitted = signal(false);
  protected readonly showControlErrors = showControlErrors;

  private currentUserId: number | null = null;
  private currentAddressId: number | null = null;

  private defaultRole: Role | null = null;
  private currentRoles: Set<Role> = new Set<Role>();

  readonly loading = signal(false);

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

  readonly headerIcon = computed(() =>
    this.isEditMode() ? 'bi-pencil-square' : 'bi-person-plus-fill',
  );

  readonly titleText = computed(() =>
    this.isEditMode() ? this.viewCopy.editTitle : this.viewCopy.createTitle,
  );

  readonly subtitleText = computed(() =>
    this.isEditMode()
      ? this.viewCopy.editSubtitle
      : this.viewCopy.createSubtitle,
  );

  ngOnInit(): void {
    this.roleService.findAll().subscribe((roles) => {
      this.defaultRole =
        Array.from(roles).find((role) => role.name === 'ROLE_USER') ?? null;
    });

    this.configurePasswordWatcher();
    const isSelfEdit = this.route.snapshot.data?.['selfEdit'] === true;

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const idParam = params.get('id');
        if (idParam) {
          const id = Number(idParam);
          if (Number.isNaN(id)) {
            void showErrorAlert('El identificador proporcionado no es válido.');
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
          void showErrorAlert('No se pudo identificar al usuario actual.');
          void this.router.navigate(['/login']);
          return;
        }

        this.resetToCreateMode();
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  protected onSubmit(): void {
    this.formSubmitted.set(true);
    if (this.formGroup.invalid) {
      return;
    }

    const { request$, successMessage, errorMessage, redirectCommand } =
      this.buildSubmitConfig();

    this.submitting.set(true);

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
      address: buildAddressFormGroup(this.formBuilder, {
        street: { min: 5, max: 50 },
        number: { min: 1, max: 10 },
        city: { min: 4, max: 30 },
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

  private configurePasswordWatcher(): void {
    const passwordControl = this.formGroup.controls.password;

    passwordControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!this.isEditMode()) return;

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
  }

  private activateEditMode(id: number): void {
    if (this.currentUserId === id && this.isEditMode()) return;

    this.isEditMode.set(true);
    this.currentUserId = id;
    this.applyEditPasswordBehaviour();
    this.loadUserForEdit(id);
  }

  private loadUserForEdit(id: number): void {
    this.loading.set(true);

    this.userService
      .getById(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (user) => {
          this.currentRoles = new Set(user.roles);

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
          void showErrorAlert(
            'No se pudo cargar la información del usuario solicitado.',
          );
          void this.router.navigate(this.submitCopy.redirectCommand);
        },
      });
  }

  private resetToCreateMode(): void {
    this.isEditMode.set(false);
    this.currentUserId = null;
    this.currentAddressId = null;
    this.formGroup.reset(this.initialValue);
    this.applyCreatePasswordBehaviour();
    this.formGroup.markAsPristine();
    this.formGroup.markAsUntouched();
    this.formSubmitted.set(false);
  }

  private applyEditPasswordBehaviour(): void {
    const pw = this.formGroup.controls.password;
    pw.setValue('', { emitEvent: false });
    pw.clearValidators();
    pw.updateValueAndValidity({ emitEvent: false });
  }

  private applyCreatePasswordBehaviour(): void {
    const pw = this.formGroup.controls.password;
    pw.setValidators([
      Validators.required,
      lengthValidator(6, 20),
      passwordStrengthValidator(),
    ]);
    pw.updateValueAndValidity({ emitEvent: false });
  }

  private buildSubmitConfig(): SubmitConfig {
    const payload = this.buildUserPayload();

    const request$ =
      this.isEditMode() && this.currentUserId != null
        ? this.userService.update(this.currentUserId, payload as User)
        : this.userService.create(payload as User);

    return composeSubmitConfig(this.submitCopy, request$, this.isEditMode());
  }

  private rolesToSend(): Set<Role> {
    if (this.isEditMode() && this.currentRoles.size) {
      return this.currentRoles;
    }
    if (this.defaultRole) {
      return new Set([this.defaultRole]);
    }
    return new Set();
  }

  private buildUserPayload(): Partial<User> {
    const rolesToSend: Set<Role> = this.rolesToSend();
    const raw = this.formGroup.getRawValue();
    const payload: Partial<User> = {
      nationalId: this.toNumber(raw.nationalId),
      firstName: raw.firstName?.trim() ?? '',
      lastName: raw.lastName?.trim() ?? '',
      phoneNumber: this.toNumber(raw.phoneNumber),
      email: raw.email?.trim() ?? '',
      username: raw.username?.trim().toLowerCase() ?? '',
      password: raw.password?.trim() || undefined,
      address: normalizeAddress(
        this.formGroup.controls.address,
        this.isEditMode() ? this.currentAddressId : null,
      ),
      enabled: true,
      accountNonExpired: true,
      accountNonLocked: true,
      credentialsNonExpired: true,
      admin: false,
      roles: Array.from(rolesToSend) as unknown as Set<Role>,
    };

    if (!payload.password) {
      delete payload.password;
    }

    if (this.isEditMode() && this.currentUserId != null) {
      payload.id = this.currentUserId;
    }

    return payload;
  }

  private toNumber(value: string | null | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}

import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormControl,
} from '@angular/forms';
import { NgClass } from '@angular/common';
import { User } from '../../../../shared/models/user.model';
import {
  lengthValidator,
  noSpecialCharactersValidator,
  passwordStrengthValidator,
} from '../../../../shared/validators/form.validator';
import { UserService } from '../../services/user.service';
import Swal from 'sweetalert2';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { Address } from '../../../../shared/models/address.model';

interface AddressFormControls {
  street: FormControl<string | null>;
  number: FormControl<string | null>;
  city: FormControl<string | null>;
}

interface UserFormControls {
  nationalId: FormControl<number | null>;
  firstName: FormControl<string | null>;
  lastName: FormControl<string | null>;
  phoneNumber: FormControl<number | null>;
  email: FormControl<string | null>;
  address: FormGroup<AddressFormControls>;
  username: FormControl<string | null>;
  password: FormControl<string | null>;
}

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, NgClass, RouterLink],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.css',
})
export class UserFormComponent implements OnInit {
  formGroup: FormGroup<UserFormControls>;
  showPassword: boolean;
  isEditMode: boolean = false;
  private currentUserId: number | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly userService: UserService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
  ) {
    this.formGroup = this.formBuilder.group({} as UserFormControls);
    this.showPassword = false;
  }

  ngOnInit(): void {
    this.initializeForm();
    this.managePasswordValidators();

    const isSelfEdit = this.route.snapshot.data['selfEdit'] === true;

    this.route.paramMap.subscribe((params) => {
      const idString = params.get('id');
      if (idString) {
        const id = Number(idString);
        if (!isNaN(id)) {
          this.setupEditMode(id);
        } else {
          this.showErrorAlert('El ID de usuario proporcionado no es válido.');
          this.router.navigateByUrl('/users');
        }
      } else if (isSelfEdit) {
        const currentUserId = this.authService.getUserId();
        if (currentUserId) {
          this.setupEditMode(currentUserId);
        } else {
          this.showErrorAlert('No se pudo identificar al usuario actual.');
          this.router.navigateByUrl('/login');
        }
      }
    });
  }

  private managePasswordValidators(): void {
    const passwordControl = this.formGroup.get('password');
    if (!passwordControl) return;

    passwordControl.valueChanges.subscribe((value) => {
      if (this.isEditMode) {
        if (value) {
          passwordControl.setValidators([
            Validators.required,
            lengthValidator(6, 20),
            passwordStrengthValidator(),
          ]);
        } else {
          passwordControl.clearValidators();
        }
        passwordControl.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  private initializeForm(): void {
    this.formGroup = this.formBuilder.group({
      nationalId: new FormControl<number | null>(null, [
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
      phoneNumber: new FormControl<number | null>(null, [
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

  private setupEditMode(id: number): void {
    this.isEditMode = true;
    this.currentUserId = id;
    this.password?.clearValidators();
    this.password?.updateValueAndValidity({ emitEvent: false });
    this.loadUserData(id);
  }

  private loadUserData(id: number): void {
    this.userService.getById(id).subscribe({
      next: (user) => {
        this.formGroup.patchValue({
          ...user,
          password: null,
        });
      },
      error: () => {
        this.showErrorAlert('No se pudo cargar la información del usuario.');
        this.router.navigateByUrl('/users');
      },
    });
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

  get street() {
    return this.formGroup.get('address.street');
  }
  get number() {
    return this.formGroup.get('address.number');
  }
  get city() {
    return this.formGroup.get('address.city');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.formGroup.invalid) return;

    const userFormData = this.formGroup.getRawValue();

    const user: Partial<User> = {
      nationalId: userFormData.nationalId ?? undefined,
      firstName: userFormData.firstName ?? undefined,
      lastName: userFormData.lastName ?? undefined,
      phoneNumber: userFormData.phoneNumber ?? undefined,
      email: userFormData.email ?? undefined,
      address: userFormData.address as Address,
      username: userFormData.username?.toLowerCase() ?? undefined,
      password: userFormData.password ?? undefined,
    };

    if (this.isEditMode) {
      if (!user.password) {
        delete user.password;
      }
      this.updateUser(this.currentUserId as number, user as User);
    } else {
      this.createUser(user as User);
    }
  }

  private createUser(user: User): void {
    this.userService.create(user).subscribe({
      next: () => {
        this.showSuccessAlert(
          'Usuario creado',
          'El usuario fue registrado exitosamente.',
        );
        this.formGroup.reset();
        this.router.navigateByUrl('/users');
      },
      error: () =>
        this.showErrorAlert(
          'No se pudo registrar el usuario. Intenta nuevamente.',
        ),
    });
  }

  private updateUser(id: number, user: User): void {
    this.userService.update(id, user).subscribe({
      next: () => {
        this.showSuccessAlert(
          'Usuario actualizado',
          'La información del usuario fue actualizada exitosamente.',
        );
        this.formGroup.reset();
        this.router.navigateByUrl('/users');
      },
      error: () =>
        this.showErrorAlert(
          'No se pudo actualizar el usuario. Intenta nuevamente.',
        ),
    });
  }

  private showSuccessAlert(title: string, text: string): void {
    Swal.fire({ icon: 'success', title, text, confirmButtonColor: '#3085d6' });
  }

  private showErrorAlert(text: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text,
      confirmButtonColor: '#d33',
    });
  }
}

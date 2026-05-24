import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Address } from '../models/address.model';
import {
  lengthValidator,
  noWhitespaceValidator,
} from '../validators/form.validator';

/**
 * Controles del formulario de dirección compartido.
 */
export interface AddressFormControls {
  street: FormControl<string | null>;
  number: FormControl<string | null>;
  city: FormControl<string | null>;
}

/**
 * Opciones de validación para los campos de dirección.
 * Cada campo define los límites de longitud y si requiere validación de whitespace.
 */
export interface AddressFieldLimits {
  street: { min: number; max: number; whitespace?: boolean };
  number: { min: number; max: number; whitespace?: boolean };
  city: { min: number; max: number; whitespace?: boolean };
}

/** Límites por defecto usados en el formulario de dirección */
const DEFAULT_LIMITS: AddressFieldLimits = {
  street: { min: 5, max: 80, whitespace: true },
  number: { min: 1, max: 10, whitespace: true },
  city: { min: 3, max: 60, whitespace: true },
};

/**
 * Construye un FormGroup<AddressFormControls> con validadores configurables.
 *
 * @param fb - FormBuilder para crear el grupo de formularios.
 * @param limits - Límites de validación para cada campo de dirección.
 * @returns FormGroup configurado para el formulario de dirección.
 */
export function buildAddressFormGroup(
  fb: FormBuilder,
  limits: AddressFieldLimits = DEFAULT_LIMITS,
): FormGroup<AddressFormControls> {
  const buildValidators = (cfg: {
    min: number;
    max: number;
    whitespace?: boolean;
  }) => {
    const v = [Validators.required, lengthValidator(cfg.min, cfg.max)];
    if (cfg.whitespace) v.push(noWhitespaceValidator());
    return v;
  };

  return fb.group<AddressFormControls>({
    street: new FormControl<string | null>('', buildValidators(limits.street)),
    number: new FormControl<string | null>('', buildValidators(limits.number)),
    city: new FormControl<string | null>('', buildValidators(limits.city)),
  });
}

/**
 * Normaliza los valores del grupo de dirección: recorta espacios y preserva el ID en modo edición.
 *
 * @param addressGroup - Grupo de formulario de dirección.
 * @param editAddressId - ID de la dirección en modo edición (opcional).
 * @returns Objeto Address normalizado.
 */
export function normalizeAddress(
  addressGroup: FormGroup<AddressFormControls> | null,
  editAddressId?: number | null,
): Address {
  const raw = addressGroup?.getRawValue() ?? {
    street: '',
    number: '',
    city: '',
  };

  const address: Address = {
    street: raw.street?.trim() ?? '',
    number: raw.number?.trim() ?? '',
    city: raw.city?.trim() ?? '',
  };

  if (editAddressId != null) {
    address.id = editAddressId;
  }

  return address;
}

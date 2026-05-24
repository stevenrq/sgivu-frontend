import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

/** Valida que la longitud (como string) esté entre `minLength` y `maxLength`. Aplica a campos de texto y numéricos.
 *
 * @param minLength Longitud mínima permitida (en caracteres o dígitos).
 * @param maxLength Longitud máxima permitida (en caracteres o dígitos).
 * @returns Un ValidatorFn que valida la longitud del control.
 */
export function lengthValidator(
  minLength: number,
  maxLength: number,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: number | string = control.value;
    if (
      value !== null &&
      (value.toString().length < minLength ||
        value.toString().length > maxLength)
    ) {
      return { invalidLength: { value: control.value } };
    }
    return null;
  };
}

/** Rechaza valores que sean solo espacios en blanco; complementa `Validators.required` que acepta strings de espacios.
 *
 * @returns Un ValidatorFn que valida que el control no sea solo espacios en blanco.
 */
export function noWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const isWhitespace = (control.value || '').trim().length === 0;
    const isValid = !isWhitespace;
    return isValid ? null : { whitespace: true };
  };
}

/** Rechaza cualquier carácter que no sea alfanumérico. Útil para campos como nombres de usuario.
 *
 * @returns Un ValidatorFn que valida que el control no contenga caracteres especiales.
 */
export function noSpecialCharactersValidator(): ValidatorFn {
  const specialCharacters = /[^a-zA-Z0-9]/;
  return (control: AbstractControl): ValidationErrors | null => {
    const forbidden: boolean = specialCharacters.test(control.value);
    return forbidden ? { forbiddenCharacters: { value: control.value } } : null;
  };
}

/** Exige mínimo una mayúscula, una minúscula, un dígito y un carácter especial (6+ caracteres).
 *
 * @returns Un ValidatorFn que valida la fortaleza de la contraseña.
 */
export function passwordStrengthValidator(): ValidatorFn {
  const strongPassword =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{6,}$/;
  return (control: AbstractControl): ValidationErrors | null => {
    const isValid: boolean = strongPassword.test(control.value);
    return isValid ? null : { weakPassword: { value: control.value } };
  };
}

/**
 * Preset de validadores para campos de texto: required + longitud + sin espacios en blanco.
 *
 * @param min - Longitud mínima permitida.
 * @param max - Longitud máxima permitida.
 * @returns Array de ValidatorFn para aplicar a un control de formulario.
 */
export function textFieldValidators(min: number, max: number): ValidatorFn[] {
  return [
    Validators.required,
    lengthValidator(min, max),
    noWhitespaceValidator(),
  ];
}

/**
 * Preset de validadores para campos numéricos como texto: required + longitud.
 *
 * @param min - Longitud mínima permitida (en dígitos).
 * @param max - Longitud máxima permitida (en dígitos).
 * @returns Array de ValidatorFn para aplicar a un control de formulario.
 */
export function numericFieldValidators(
  min: number,
  max: number,
): ValidatorFn[] {
  return [Validators.required, lengthValidator(min, max)];
}

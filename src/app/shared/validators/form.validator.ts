import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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

export function noWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const isWhitespace = (control.value || '').trim().length === 0;
    const isValid = !isWhitespace;
    return isValid ? null : { whitespace: true };
  };
}

export function noSpecialCharactersValidator(): ValidatorFn {
  const specialCharacters: RegExp = /[^a-zA-Z0-9]/;
  return (control: AbstractControl): ValidationErrors | null => {
    const forbidden: boolean = specialCharacters.test(control.value);
    return forbidden ? { forbiddenCharacters: { value: control.value } } : null;
  };
}

export function passwordStrengthValidator(): ValidatorFn {
  const strongPassword: RegExp =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{6,}$/;
  return (control: AbstractControl): ValidationErrors | null => {
    const isValid: boolean = strongPassword.test(control.value);
    return !isValid ? { weakPassword: { value: control.value } } : null;
  };
}

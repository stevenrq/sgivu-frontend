import { AbstractControl } from '@angular/forms';

/**
 * Determina si se deben mostrar errores de validación para un control de formulario reactivo.
 * Los errores solo se muestran cuando el formulario ha sido enviado al menos una vez.
 *
 * @param control - Control de formulario a evaluar.
 * @param submitted - Indica si el formulario fue enviado al menos una vez.
 * @returns `true` si el control es inválido y el formulario fue enviado.
 */
export function showControlErrors(
  control: AbstractControl | null | undefined,
  submitted: boolean,
): boolean {
  if (!control) {
    return false;
  }
  return !!control.invalid && submitted;
}

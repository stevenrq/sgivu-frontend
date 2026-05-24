import Swal, { SweetAlertResult } from 'sweetalert2';

// ── Toast mixin (standalone, no DI needed) ──────────────
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
  customClass: { popup: 'swal-toast-popup' },
});

/**
 * Muestra un toast de éxito no bloqueante en la esquina superior derecha.
 *
 * @param message - Texto del mensaje de éxito.
 * @param timer - Duración en milisegundos antes de que el toast desaparezca (por defecto 3000).
 * @returns Promesa con el resultado de SweetAlert2.
 */
export function showSuccessAlert(
  message: string,
  timer = 3000,
): Promise<SweetAlertResult> {
  return Toast.fire({
    icon: 'success',
    title: message,
    timer,
  });
}

/**
 * Muestra un toast de error no bloqueante en la esquina superior derecha.
 *
 * @param message - Texto del mensaje de error.
 * @param timer - Duración en milisegundos antes de que el toast desaparezca (por defecto 4000).
 * @returns Promesa con el resultado de SweetAlert2.
 */
export function showErrorAlert(
  message: string,
  timer = 4000,
): Promise<SweetAlertResult> {
  return Toast.fire({
    icon: 'error',
    title: message,
    timer,
  });
}

/**
 * Muestra un diálogo de confirmación modal con botones de confirmar/cancelar.
 * Es bloqueante porque requiere interacción explícita del usuario.
 *
 * @param options.title - Título del diálogo.
 * @param options.text - Mensaje descriptivo del diálogo.
 * @param options.confirmText - Texto del botón de confirmación (por defecto `'Sí, confirmar'`).
 * @param options.cancelText - Texto del botón de cancelación (por defecto `'Cancelar'`).
 * @param options.icon - Icono del diálogo: `'warning'`, `'info'` o `'question'` (por defecto `'warning'`).
 * @returns Promesa con el resultado: `isConfirmed` indica si el usuario confirmó.
 */
export function showConfirmDialog(options: {
  title: string;
  text: string;
  confirmText?: string;
  cancelText?: string;
  icon?: 'warning' | 'info' | 'question';
}): Promise<SweetAlertResult> {
  return Swal.fire({
    icon: options.icon ?? 'warning',
    title: options.title,
    text: options.text,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? 'Sí, confirmar',
    cancelButtonText: options.cancelText ?? 'Cancelar',
  });
}

/**
 * Muestra una alerta modal bloqueante con icono y título personalizados.
 * Usada para advertencias y errores que requieren atención explícita del usuario.
 *
 * @param options.icon - Tipo de icono: `'success'`, `'error'`, `'warning'` o `'info'`.
 * @param options.title - Título de la alerta.
 * @param options.text - Cuerpo del mensaje.
 * @returns Promesa con el resultado de SweetAlert2.
 */
export function showAlert(options: {
  icon: 'success' | 'error' | 'warning' | 'info';
  title: string;
  text: string;
}): Promise<SweetAlertResult> {
  return Swal.fire({
    icon: options.icon,
    title: options.title,
    text: options.text,
  });
}

/**
 * Alias de `showSuccessAlert`. Muestra un toast de éxito temporizado no bloqueante.
 *
 * @param message - Texto del mensaje de éxito.
 * @param timer - Duración en milisegundos (por defecto 3000).
 * @returns Promesa con el resultado de SweetAlert2.
 */
export function showTimedSuccessAlert(
  message: string,
  timer = 3000,
): Promise<SweetAlertResult> {
  return showSuccessAlert(message, timer);
}

import { showAlert } from './swal-alert.utils';

/**
 * Muestra un diálogo de error basado en un error HTTP.
 * Extrae detalles del backend si están disponibles y aplica un decorador opcional al mensaje.
 *
 * @param error - Error capturado (normalmente un HttpErrorResponse).
 * @param action - Descripción de la acción que falló (e.g., 'registrar el contrato').
 * @param messageDecorator - Función opcional para transformar el mensaje (e.g., reemplazar IDs por labels).
 */
export function showHttpError(
  error: unknown,
  action: string,
  messageDecorator?: (message: string) => string,
): void {
  const details =
    (error as { error?: { details?: string } })?.error?.details ?? null;
  const rawMessage =
    details ?? `Se presentó un inconveniente al ${action}. Intenta nuevamente.`;
  const message = messageDecorator ? messageDecorator(rawMessage) : rawMessage;

  void showAlert({ icon: 'error', title: 'Oops...', text: message });
}

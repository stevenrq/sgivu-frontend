import { Injectable, inject } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';
import { ThemeService } from './theme.service';

/**
 * Servicio de notificaciones toast no-bloqueantes usando SweetAlert2.
 *
 * Usa `Swal.mixin()` en modo toast para mostrar notificaciones breves
 * en la esquina superior derecha que desaparecen automáticamente,
 * sin interrumpir el flujo del usuario.
 */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly themeService = inject(ThemeService);

  private showToast(icon: SweetAlertIcon, title: string, timer = 3000): void {
    const isDark = this.themeService.activeTheme() === 'dark';

    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer,
      timerProgressBar: true,
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#e7ecf7' : '#0f172a',
      iconColor: this.getIconColor(icon, isDark),
      customClass: {
        popup: 'swal-toast-popup',
      },
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      },
    });

    void Toast.fire({ icon, title });
  }

  private getIconColor(icon: SweetAlertIcon, isDark: boolean): string {
    const colors: Record<string, { light: string; dark: string }> = {
      success: { light: '#16a34a', dark: '#22c55e' },
      error: { light: '#dc2626', dark: '#f87171' },
      warning: { light: '#d97706', dark: '#fbbf24' },
      info: { light: '#2563eb', dark: '#60a5fa' },
    };
    const colorPair = colors[icon] ?? colors['info']!;
    return isDark ? colorPair.dark : colorPair.light;
  }

  /**
   * Muestra un toast de éxito.
   *
   * @param title - Texto del mensaje.
   * @param timer - Duración en milisegundos (por defecto 3000).
   */
  success(title: string, timer?: number): void {
    this.showToast('success', title, timer);
  }

  /**
   * Muestra un toast de error.
   *
   * @param title - Texto del mensaje.
   * @param timer - Duración en milisegundos (por defecto 4000).
   */
  error(title: string, timer?: number): void {
    this.showToast('error', title, timer ?? 4000);
  }

  /**
   * Muestra un toast de advertencia.
   *
   * @param title - Texto del mensaje.
   * @param timer - Duración en milisegundos (por defecto 3000).
   */
  warning(title: string, timer?: number): void {
    this.showToast('warning', title, timer);
  }

  /**
   * Muestra un toast informativo.
   *
   * @param title - Texto del mensaje.
   * @param timer - Duración en milisegundos (por defecto 3000).
   */
  info(title: string, timer?: number): void {
    this.showToast('info', title, timer);
  }
}

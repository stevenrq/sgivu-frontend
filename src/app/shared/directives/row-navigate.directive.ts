import { Directive, inject, input } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';

/**
 * Hace que un `<tr>` o cualquier elemento sea navegable por click.
 * Ignora clicks en elementos interactivos hijos (`a`, `button`, `input`, etc.)
 * para evitar navegación accidental al interactuar con controles dentro de la fila.
 */
@Directive({
  selector: '[appRowNavigate]',
  host: {
    class: 'row-navigate',
    '(click)': 'handleClick($event)',
  },
})
export class RowNavigateDirective {
  private readonly router = inject(Router);

  /** Ruta de destino: string URL o segmentos para `Router.navigate`. */
  readonly appRowNavigate = input.required<
    string | (string | number | undefined)[]
  >();

  /** Query params para adjuntar a la navegación. */
  readonly queryParams = input<NavigationExtras['queryParams']>();
  /** Opciones adicionales de navegación del router de Angular. */
  readonly navigationExtras = input<NavigationExtras>();
  /** Si es `true`, deshabilita la navegación al hacer click en la fila. */
  readonly appRowNavigateDisabled = input(false);

  /**
   * Maneja el click en el elemento host y navega a la ruta configurada.
   * Ignora clicks en elementos interactivos hijos para evitar navegación accidental.
   *
   * @param event - Evento de click del DOM.
   */
  async handleClick(event: Event): Promise<void> {
    if (this.appRowNavigateDisabled()) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button, select, option, input, textarea, label')) {
      return; // Respeta interacciones internas.
    }

    event.preventDefault();
    event.stopPropagation();

    const extras: NavigationExtras = {
      queryParams: this.queryParams(),
      ...this.navigationExtras(),
    };

    const route = this.appRowNavigate();
    if (typeof route === 'string') {
      await this.router.navigateByUrl(route, extras);
    } else {
      await this.router.navigate(route, extras);
    }
  }
}

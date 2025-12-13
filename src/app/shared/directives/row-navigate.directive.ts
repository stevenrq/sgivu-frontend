import { Directive, HostBinding, HostListener, Input } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';

@Directive({
  selector: '[appRowNavigate]',
  standalone: true,
})
/**
 * Permite hacer clic en filas (o cualquier contenedor) para navegar, ignorando
 * clicks en elementos interactivos internos como enlaces, botones o selects.
 */
export class RowNavigateDirective {
  @Input({ required: true }) appRowNavigate: string | any[] = '';

  @Input() queryParams?: NavigationExtras['queryParams'];

  @Input() navigationExtras?: NavigationExtras;

  @Input() appRowNavigateDisabled = false;

  @HostBinding('class.row-navigate')
  readonly clickableClass = true;

  constructor(private readonly router: Router) {}

  @HostListener('click', ['$event'])
  async handleClick(event: Event): Promise<void> {
    if (this.appRowNavigateDisabled) return;

    const target = event.target as HTMLElement | null;
    if (
      target &&
      target.closest('a, button, select, option, input, textarea, label')
    ) {
      return; // Respeta interacciones internas.
    }

    event.preventDefault();
    event.stopPropagation();

    const extras: NavigationExtras = {
      queryParams: this.queryParams,
      ...this.navigationExtras,
    };

    if (typeof this.appRowNavigate === 'string') {
      await this.router.navigateByUrl(this.appRowNavigate, extras);
    } else {
      await this.router.navigate(this.appRowNavigate, extras);
    }
  }
}

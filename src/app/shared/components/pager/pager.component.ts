import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { PaginatedResponse } from '../../models/paginated-response';
import { Params, RouterLink } from '@angular/router';

/**
 * Componente de controles de paginación basado en `RouterLink`.
 * Genera los enlaces de navegación a partir de un `PaginatedResponse`
 * y soporta query params adicionales para preservar los filtros activos.
 *
 * @example
 * ```html
 * <app-pager [pager]="page()" url="/vehicles/cars" [queryParams]="queryParams()" />
 * ```
 */
@Component({
  selector: 'app-pager',
  imports: [RouterLink],
  templateUrl: './pager.component.html',
  styleUrls: ['./pager.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagerComponent<T = unknown> {
  /** Respuesta paginada del backend que contiene `number`, `totalPages`, etc. */
  readonly pager = input.required<PaginatedResponse<T>>();
  /** Ruta base para los enlaces de paginación (sin índice de página). */
  readonly url = input.required<string>();
  /** Query params adicionales a preservar en los enlaces (e.g., filtros activos). */
  readonly queryParams = input<Params | null>(null);

  /** Índice de la primera página (siempre 0). */
  readonly firstPageIndex = 0;

  /** Índice de la última página calculado a partir de `totalPages`. */
  readonly lastPageIndex = computed(() => {
    const p = this.pager();
    return p ? p.totalPages - 1 : 0;
  });

  /** Lista de números de página a mostrar en el paginador (ventana deslizante). */
  readonly pages = computed(() => {
    const p = this.pager();
    return p ? this.generatePages(p.number, p.totalPages) : [];
  });

  /**
   * Genera una ventana deslizante de páginas centrada en la página actual.
   * Garantiza un número impar de páginas para simetría visual.
   *
   * @param currentPage - Índice de la página actual (base 0).
   * @param totalPages - Número total de páginas.
   * @param pagesToShow - Cantidad de páginas a mostrar (por defecto 5, se ajusta a impar).
   * @returns Arreglo de números de página (base 1) a renderizar.
   */
  public generatePages(
    currentPage: number,
    totalPages: number,
    pagesToShow = 5,
  ): number[] {
    if (pagesToShow % 2 === 0) {
      pagesToShow++;
    }

    const pages: number[] = [];

    if (totalPages <= pagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    const halfPagesToShow = Math.floor(pagesToShow / 2);
    let startPage: number;
    let endPage: number;
    const currentPageOneBased = currentPage + 1;

    if (currentPageOneBased <= halfPagesToShow) {
      startPage = 1;
      endPage = pagesToShow;
    } else if (currentPageOneBased + halfPagesToShow >= totalPages) {
      startPage = totalPages - pagesToShow + 1;
      endPage = totalPages;
    } else {
      startPage = currentPageOneBased - halfPagesToShow;
      endPage = currentPageOneBased + halfPagesToShow;
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }
}

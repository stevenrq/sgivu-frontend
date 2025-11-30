import {
  Directive,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { forkJoin, map, Subject, takeUntil } from 'rxjs';
import { PermissionService } from '../../features/auth/services/permission.service';

/**
 * Directiva estructural para controlar la visibilidad de elementos HTML basándose en los permisos del usuario.
 * Puede verificar un solo permiso, o un arreglo de permisos con lógica AND/OR.
 *
 * @example
 * <!-- Muestra si el usuario tiene el permiso 'user:create' -->
 * <div *appHasPermission="'user:create'">...</div>
 *
 * <!-- Muestra si el usuario tiene 'user:update' O 'user:edit' (lógica OR por defecto) -->
 * <div *appHasPermission="['user:update', 'user:edit']">...</div>
 *
 * <!-- Muestra si el usuario tiene 'user:read' Y 'report:view' (lógica AND explícita) -->
 * <div *appHasPermission="['user:read', 'report:view']; logic: 'AND'">...</div>
 */
@Directive({
  selector: '[appHasPermission]',
})
/** Directiva estructural que muestra u oculta vistas según permisos del usuario. */
export class HasPermissionDirective implements OnChanges, OnDestroy {
  /**
   * Permiso o lista de permisos a verificar.
   * Puede ser un string (ej. 'user:create') o un array de strings (ej. ['user:update', 'user:delete']).
   */
  @Input('appHasPermission')
  permissions: string | string[] | undefined;

  /**
   * Lógica para combinar múltiples permisos.
   * - 'OR' (por defecto): El elemento se muestra si el usuario tiene AL MENOS UNO de los permisos.
   * - 'AND': El elemento se muestra si el usuario tiene TODOS los permisos especificados.
   */
  @Input('appHasPermissionLogic')
  logic: 'AND' | 'OR' = 'OR';

  /**
   * Indica si la vista ya ha sido creada en el DOM.
   * @private
   */
  private hasView = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly templateRef: TemplateRef<any>,
    private readonly viewContainerRef: ViewContainerRef,
    private readonly permissionService: PermissionService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['permissions'] || changes['logic']) {
      this.updateView();
    }
  }

  /**
   * Reconstruye la vista según los permisos actuales. Determina la combinación AND/OR
   * y se suscribe a los observables del `PermissionService`.
   */
  private updateView(): void {
    this.destroy$.next();

    let permissionsToCheck: string[] = [];
    if (typeof this.permissions === 'string') {
      permissionsToCheck = [this.permissions];
    } else if (Array.isArray(this.permissions)) {
      permissionsToCheck = this.permissions;
    }

    if (permissionsToCheck.length === 0) {
      this.clearView();
      return;
    }

    const permissionChecks$ = permissionsToCheck.map((p) =>
      this.permissionService.hasPermission(p),
    );

    const finalPermission$ =
      permissionsToCheck.length > 1 && this.logic === 'AND'
        ? forkJoin(permissionChecks$).pipe(
            map((results) => results.every((res) => res)),
          )
        : forkJoin(permissionChecks$).pipe(
            map((results) => results.some((res) => res)),
          );

    finalPermission$
      .pipe(takeUntil(this.destroy$))
      .subscribe((hasPermission) => {
        this.handlePermissionResult(hasPermission);
      });
  }

  /**
   * Crea o elimina la vista embebida según el resultado de los permisos evaluados.
   *
   * @param hasPermission Indica si se deben renderizar los elementos hijos.
   */
  private handlePermissionResult(hasPermission: boolean): void {
    if (hasPermission && !this.hasView) {
      this.viewContainerRef.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasPermission && this.hasView) {
      this.clearView();
    }
  }

  /** Elimina la vista del DOM y marca el flag interno en falso. */
  private clearView(): void {
    this.viewContainerRef.clear();
    this.hasView = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

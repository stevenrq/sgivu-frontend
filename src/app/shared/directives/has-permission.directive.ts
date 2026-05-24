import {
  Directive,
  DestroyRef,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<void>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly permissionService = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  /** Permiso o lista de permisos a verificar. Acepta string único o arreglo. */
  readonly permissions = input<string | string[] | undefined>(undefined, {
    alias: 'appHasPermission',
  });
  /** Lógica de combinación cuando se pasan múltiples permisos: `'AND'` (todos) u `'OR'` (alguno). */
  readonly logic = input<'AND' | 'OR'>('OR', {
    alias: 'appHasPermissionLogic',
  });

  private hasView = false;

  /**
   * Subject usado para cancelar la suscripción previa al recalcular permisos.
   * Evita condiciones de carrera cuando `permissions` o `logic` cambian rápidamente.
   */
  private readonly cancelPrevious$ = new Subject<void>();

  constructor() {
    effect(() => {
      // Leer los signal inputs para que el effect se re-ejecute cuando cambien
      this.permissions();
      this.logic();
      this.updateView();
    });
  }

  /**
   * Cancela la suscripción previa, resuelve los permisos actuales
   * y actualiza la visibilidad del elemento proyectado.
   */
  private updateView(): void {
    this.cancelPrevious$.next();

    const perms = this.permissions();
    let permissionsToCheck: string[] = [];
    if (typeof perms === 'string') {
      permissionsToCheck = [perms];
    } else if (Array.isArray(perms)) {
      permissionsToCheck = perms;
    }

    if (permissionsToCheck.length === 0) {
      this.clearView();
      return;
    }

    const permissionChecks$ = permissionsToCheck.map((p) =>
      this.permissionService.hasPermission(p),
    );

    const finalPermission$ =
      permissionsToCheck.length > 1 && this.logic() === 'AND'
        ? forkJoin(permissionChecks$).pipe(
            map((results) => results.every(Boolean)),
          )
        : forkJoin(permissionChecks$).pipe(
            map((results) => results.some(Boolean)),
          );

    finalPermission$
      .pipe(
        takeUntil(this.cancelPrevious$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((hasPermission) => {
        if (hasPermission) {
          this.onPermissionGranted();
        } else {
          this.onPermissionDenied();
        }
      });
  }

  private onPermissionGranted(): void {
    if (!this.hasView) {
      this.viewContainerRef.createEmbeddedView(this.templateRef);
      this.hasView = true;
    }
  }

  private onPermissionDenied(): void {
    if (this.hasView) {
      this.clearView();
    }
  }

  private clearView(): void {
    this.viewContainerRef.clear();
    this.hasView = false;
  }
}

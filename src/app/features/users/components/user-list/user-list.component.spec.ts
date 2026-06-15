import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { convertToParamMap, Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { UserListComponent } from './user-list.component';
import { UserService } from '../../services/user.service';
import { UserUiHelperService } from '../../../../shared/services/user-ui-helper.service';

describe('UserListComponent', () => {
  let fixture: ComponentFixture<UserListComponent>;
  let component: UserListComponent;
  let navigateSpy: ReturnType<typeof vi.fn>;

  const paramMap$ = new BehaviorSubject(convertToParamMap({ page: '0' }));
  const queryParamMap$ = new BehaviorSubject(convertToParamMap({}));

  beforeEach(async () => {
    navigateSpy = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: UserService,
          useValue: {
            getAllPaginated: () => EMPTY,
            searchUsersPaginated: () => EMPTY,
            getUserCount: () => EMPTY,
            getAll: () => EMPTY,
          },
        },
        { provide: UserUiHelperService, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            queryParamMap: queryParamMap$.asObservable(),
          },
        },
        { provide: Router, useValue: { navigate: navigateSpy } },
      ],
    })
      .overrideComponent(UserListComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('estado inicial de filtros', () => {
    it('todos los campos deben empezar vacíos', () => {
      const f = component.filters();
      expect(f.name).toBe('');
      expect(f.username).toBe('');
      expect(f.email).toBe('');
      expect(f.role).toBe('');
      expect(f.enabled).toBe('');
    });

    it('advancedFiltersCount debe ser 0', () => {
      expect((component as any).advancedFiltersCount).toBe(0);
    });

    it('activeChips debe estar vacío', () => {
      expect((component as any).activeChips).toEqual([]);
    });
  });

  describe('patchFilters', () => {
    it('debe actualizar el campo indicado sin afectar los demás', () => {
      (component as any).patchFilters({ role: 'ADMIN' });
      const f = component.filters();
      expect(f.role).toBe('ADMIN');
      expect(f.name).toBe('');
      expect(f.email).toBe('');
    });
  });

  describe('advancedFiltersCount', () => {
    it('debe contar solo los campos avanzados no vacíos', () => {
      (component as any).patchFilters({ role: 'ADMIN', email: 'a@b.com' });
      expect((component as any).advancedFiltersCount).toBe(2);
    });

    it('no cuenta el campo name como filtro avanzado', () => {
      (component as any).patchFilters({ name: 'Juan' });
      expect((component as any).advancedFiltersCount).toBe(0);
    });
  });

  describe('activeChips', () => {
    it('debe construir el chip de rol con la etiqueta correcta', () => {
      (component as any).patchFilters({ role: 'ADMIN' });
      const chips: { filterKey: string; label: string }[] = (component as any)
        .activeChips;
      expect(chips).toHaveLength(1);
      expect(chips[0]).toEqual({ filterKey: 'role', label: 'Rol: ADMIN' });
    });

    it('no debe incluir el campo name en los chips', () => {
      (component as any).patchFilters({ name: 'Juan' });
      expect((component as any).activeChips).toEqual([]);
    });

    it('debe construir chip de estado activo correctamente', () => {
      (component as any).patchFilters({ enabled: 'true' });
      const chips: { filterKey: string; label: string }[] = (component as any)
        .activeChips;
      expect(chips[0].label).toBe('Estado: Activo');
    });
  });

  describe('onSearchValueChange', () => {
    it('debe actualizar el campo name del filtro', () => {
      (component as any).onSearchValueChange('Maria');
      expect(component.filters().name).toBe('Maria');
    });
  });

  describe('applyFilters', () => {
    it('debe navegar a /users/page/0 con queryParams cuando hay filtros', () => {
      (component as any).patchFilters({ role: 'ADMIN' });
      navigateSpy.mockClear();

      (component as any).applyFilters();

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/users/page', 0],
        expect.objectContaining({ queryParams: expect.any(Object) }),
      );
    });

    it('debe navegar a /users/page/0 sin queryParams cuando los filtros están vacíos', () => {
      navigateSpy.mockClear();

      (component as any).applyFilters();

      expect(navigateSpy).toHaveBeenCalledWith(['/users/page', 0]);
    });
  });

  describe('clearFilters', () => {
    it('debe resetear todos los filtros y navegar sin queryParams', () => {
      (component as any).patchFilters({ role: 'ADMIN', email: 'a@b.com' });
      navigateSpy.mockClear();

      (component as any).clearFilters();

      const f = component.filters();
      expect(f.role).toBe('');
      expect(f.email).toBe('');
      expect(navigateSpy).toHaveBeenCalledWith(['/users/page', 0]);
    });
  });

  describe('removeFilter', () => {
    it('debe resetear solo el campo indicado y aplicar filtros', () => {
      (component as any).patchFilters({ role: 'ADMIN', email: 'a@b.com' });
      navigateSpy.mockClear();

      (component as any).removeFilter('role');

      expect(component.filters().role).toBe('');
      expect(component.filters().email).toBe('a@b.com');
      expect(navigateSpy).toHaveBeenCalled();
    });
  });
});

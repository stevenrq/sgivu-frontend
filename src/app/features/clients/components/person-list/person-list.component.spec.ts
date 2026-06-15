import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { convertToParamMap, Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { PersonListComponent } from './person-list.component';
import { PersonService } from '../../services/person.service';
import { ClientUiHelperService } from '../../../../shared/services/client-ui-helper.service';

describe('PersonListComponent', () => {
  let fixture: ComponentFixture<PersonListComponent>;
  let component: PersonListComponent;
  let navigateSpy: ReturnType<typeof vi.fn>;

  const paramMap$ = new BehaviorSubject(convertToParamMap({ page: '0' }));
  const queryParamMap$ = new BehaviorSubject(convertToParamMap({}));

  beforeEach(async () => {
    navigateSpy = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: PersonService,
          useValue: {
            getAllPaginated: () => EMPTY,
            searchPaginated: () => EMPTY,
            getPersonCount: () => EMPTY,
            getAll: () => EMPTY,
          },
        },
        { provide: ClientUiHelperService, useValue: {} },
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
      .overrideComponent(PersonListComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PersonListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('estado inicial de filtros', () => {
    it('todos los campos deben empezar vacíos', () => {
      const f = component.filters();
      expect(f.name).toBe('');
      expect(f.email).toBe('');
      expect(f.nationalId).toBe('');
      expect(f.phoneNumber).toBe('');
      expect(f.city).toBe('');
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
      (component as any).patchFilters({ city: 'Bogotá' });
      const f = component.filters();
      expect(f.city).toBe('Bogotá');
      expect(f.name).toBe('');
      expect(f.email).toBe('');
    });
  });

  describe('advancedFiltersCount', () => {
    it('debe contar solo los campos avanzados no vacíos', () => {
      (component as any).patchFilters({ nationalId: '123', city: 'Cali' });
      expect((component as any).advancedFiltersCount).toBe(2);
    });

    it('no cuenta el campo name como filtro avanzado', () => {
      (component as any).patchFilters({ name: 'Ana' });
      expect((component as any).advancedFiltersCount).toBe(0);
    });
  });

  describe('activeChips', () => {
    it('debe construir el chip de ciudad con la etiqueta correcta', () => {
      (component as any).patchFilters({ city: 'Medellín' });
      const chips: { filterKey: string; label: string }[] = (component as any)
        .activeChips;
      expect(chips).toHaveLength(1);
      expect(chips[0]).toEqual({
        filterKey: 'city',
        label: 'Ciudad: Medellín',
      });
    });

    it('no debe incluir el campo name en los chips', () => {
      (component as any).patchFilters({ name: 'Pedro' });
      expect((component as any).activeChips).toEqual([]);
    });

    it('debe construir chip de documento con la etiqueta correcta', () => {
      (component as any).patchFilters({ nationalId: '12345678' });
      const chips: { filterKey: string; label: string }[] = (component as any)
        .activeChips;
      expect(chips[0]).toEqual({
        filterKey: 'nationalId',
        label: 'Doc: 12345678',
      });
    });
  });

  describe('onSearchValueChange', () => {
    it('debe actualizar el campo name del filtro', () => {
      (component as any).onSearchValueChange('Carlos');
      expect(component.filters().name).toBe('Carlos');
    });
  });

  describe('applyFilters', () => {
    it('debe navegar a /clients/persons/page/0 con queryParams cuando hay filtros', () => {
      (component as any).patchFilters({ city: 'Bogotá' });
      navigateSpy.mockClear();

      (component as any).applyFilters();

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/clients/persons/page', 0],
        expect.objectContaining({ queryParams: expect.any(Object) }),
      );
    });

    it('debe navegar a /clients/persons/page/0 sin queryParams cuando los filtros están vacíos', () => {
      navigateSpy.mockClear();

      (component as any).applyFilters();

      expect(navigateSpy).toHaveBeenCalledWith(['/clients/persons/page', 0]);
    });
  });

  describe('clearFilters', () => {
    it('debe resetear todos los filtros y navegar sin queryParams', () => {
      (component as any).patchFilters({ city: 'Cali', nationalId: '111' });
      navigateSpy.mockClear();

      (component as any).clearFilters();

      const f = component.filters();
      expect(f.city).toBe('');
      expect(f.nationalId).toBe('');
      expect(navigateSpy).toHaveBeenCalledWith(['/clients/persons/page', 0]);
    });
  });

  describe('removeFilter', () => {
    it('debe resetear solo el campo indicado y aplicar filtros', () => {
      (component as any).patchFilters({ city: 'Cali', email: 'x@y.com' });
      navigateSpy.mockClear();

      (component as any).removeFilter('city');

      expect(component.filters().city).toBe('');
      expect(component.filters().email).toBe('x@y.com');
      expect(navigateSpy).toHaveBeenCalled();
    });
  });
});

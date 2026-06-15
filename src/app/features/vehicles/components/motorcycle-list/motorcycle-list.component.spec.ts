import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { convertToParamMap, Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { MotorcycleListComponent } from './motorcycle-list.component';
import { MotorcycleService } from '../../services/motorcycle.service';
import { VehicleUiHelperService } from '../../../../shared/services/vehicle-ui-helper.service';
import { ToastService } from '../../../../shared/services/toast.service';

describe('MotorcycleListComponent', () => {
  let fixture: ComponentFixture<MotorcycleListComponent>;
  let component: MotorcycleListComponent;
  let navigateSpy: ReturnType<typeof vi.fn>;

  const paramMap$ = new BehaviorSubject(convertToParamMap({ page: '0' }));
  const queryParamMap$ = new BehaviorSubject(convertToParamMap({}));

  beforeEach(async () => {
    navigateSpy = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: MotorcycleService,
          useValue: {
            getAllPaginated: () => EMPTY,
            searchPaginated: () => EMPTY,
            getCounts: () => EMPTY,
            getAll: () => EMPTY,
          },
        },
        { provide: VehicleUiHelperService, useValue: {} },
        { provide: ToastService, useValue: { show: () => {} } },
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
      .overrideComponent(MotorcycleListComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MotorcycleListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('estado inicial de filtros', () => {
    it('plate y campos de texto deben empezar vacíos', () => {
      const f = component.filters();
      expect(f.plate).toBe('');
      expect(f.brand).toBe('');
      expect(f.line).toBe('');
      expect(f.model).toBe('');
      expect(f.motorcycleType).toBe('');
      expect(f.transmission).toBe('');
      expect(f.status).toBe('');
    });

    it('campos numéricos deben empezar en null', () => {
      const f = component.filters();
      expect(f.minYear).toBeNull();
      expect(f.maxYear).toBeNull();
      expect(f.minCapacity).toBeNull();
      expect(f.maxCapacity).toBeNull();
    });

    it('advancedFiltersCount debe ser 0', () => {
      expect((component as any).advancedFiltersCount).toBe(0);
    });
  });

  describe('patchFilters', () => {
    it('debe actualizar el campo indicado sin afectar los demás', () => {
      (component as any).patchFilters({ brand: 'Honda' });
      const f = component.filters();
      expect(f.brand).toBe('Honda');
      expect(f.plate).toBe('');
    });
  });

  describe('advancedFiltersCount', () => {
    it('debe contar campos avanzados no vacíos', () => {
      (component as any).patchFilters({
        brand: 'Honda',
        motorcycleType: 'SPORT',
        transmission: 'MANUAL',
      });
      expect((component as any).advancedFiltersCount).toBe(3);
    });

    it('debe contar campos numéricos no nulos', () => {
      (component as any).patchFilters({ minYear: 2019, minCapacity: 150 });
      expect((component as any).advancedFiltersCount).toBe(2);
    });

    it('no cuenta plate como filtro avanzado', () => {
      (component as any).patchFilters({ plate: 'MOT001' });
      expect((component as any).advancedFiltersCount).toBe(0);
    });
  });

  describe('activeChips', () => {
    it('debe construir chip de marca correctamente', () => {
      (component as any).patchFilters({ brand: 'Honda' });
      const chips: { filterKey: string; label: string }[] = (component as any)
        .activeChips;
      expect(chips.some((c) => c.filterKey === 'brand')).toBe(true);
    });

    it('no debe incluir plate en los chips', () => {
      (component as any).patchFilters({ plate: 'MOT001' });
      const chips: { filterKey: string; label: string }[] = (component as any)
        .activeChips;
      expect(chips.every((c) => c.filterKey !== 'plate')).toBe(true);
    });
  });

  describe('onSearchValueChange', () => {
    it('debe actualizar el campo plate del filtro', () => {
      (component as any).onSearchValueChange('MOT123');
      expect(component.filters().plate).toBe('MOT123');
    });
  });

  describe('applyFilters', () => {
    it('debe llamar clearFilters cuando todos los filtros están vacíos', () => {
      navigateSpy.mockClear();
      const clearSpy = vi.spyOn(component as any, 'clearFilters');

      (component as any).applyFilters();

      expect(clearSpy).toHaveBeenCalled();
    });

    it('debe navegar con queryParams cuando hay filtros avanzados', () => {
      (component as any).patchFilters({ brand: 'Honda' });
      navigateSpy.mockClear();

      (component as any).applyFilters();

      expect(navigateSpy).toHaveBeenCalled();
    });
  });

  describe('clearFilters', () => {
    it('debe resetear todos los filtros y navegar', () => {
      (component as any).patchFilters({ brand: 'Honda', minYear: 2020 });
      navigateSpy.mockClear();

      (component as any).clearFilters();

      const f = component.filters();
      expect(f.brand).toBe('');
      expect(f.minYear).toBeNull();
      expect(navigateSpy).toHaveBeenCalled();
    });
  });

  describe('removeFilter', () => {
    it('debe resetear el campo indicado y aplicar filtros', () => {
      (component as any).patchFilters({ brand: 'Honda' });
      navigateSpy.mockClear();

      (component as any).removeFilter('brand');

      expect(component.filters().brand).toBe('');
      expect(navigateSpy).toHaveBeenCalled();
    });
  });
});

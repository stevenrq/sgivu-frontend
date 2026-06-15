import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { convertToParamMap, Router, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { CompanyListComponent } from './company-list.component';
import { CompanyService } from '../../services/company.service';
import { ClientUiHelperService } from '../../../../shared/services/client-ui-helper.service';

describe('CompanyListComponent', () => {
  let fixture: ComponentFixture<CompanyListComponent>;
  let component: CompanyListComponent;
  let navigateSpy: ReturnType<typeof vi.fn>;

  const paramMap$ = new BehaviorSubject(convertToParamMap({ page: '0' }));
  const queryParamMap$ = new BehaviorSubject(convertToParamMap({}));

  beforeEach(async () => {
    navigateSpy = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: CompanyService,
          useValue: {
            getAllPaginated: () => EMPTY,
            searchPaginated: () => EMPTY,
            getCompanyCount: () => EMPTY,
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
      .overrideComponent(CompanyListComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CompanyListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('estado inicial de filtros', () => {
    it('todos los campos deben empezar vacíos', () => {
      const f = component.filters();
      expect(f.companyName).toBe('');
      expect(f.taxId).toBe('');
      expect(f.email).toBe('');
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
      (component as any).patchFilters({ taxId: '900123' });
      const f = component.filters();
      expect(f.taxId).toBe('900123');
      expect(f.companyName).toBe('');
    });
  });

  describe('advancedFiltersCount', () => {
    it('debe contar solo los campos avanzados no vacíos', () => {
      (component as any).patchFilters({
        taxId: '900',
        city: 'Bogotá',
        phoneNumber: '3001',
      });
      expect((component as any).advancedFiltersCount).toBe(3);
    });

    it('no cuenta el campo companyName como filtro avanzado', () => {
      (component as any).patchFilters({ companyName: 'Acme' });
      expect((component as any).advancedFiltersCount).toBe(0);
    });
  });

  describe('activeChips', () => {
    it('debe construir el chip de NIT con la etiqueta correcta', () => {
      (component as any).patchFilters({ taxId: '900123456' });
      const chips: { filterKey: string; label: string }[] = (component as any)
        .activeChips;
      expect(chips).toHaveLength(1);
      expect(chips[0]).toEqual({ filterKey: 'taxId', label: 'NIT: 900123456' });
    });

    it('no debe incluir companyName en los chips', () => {
      (component as any).patchFilters({ companyName: 'MiEmpresa' });
      expect((component as any).activeChips).toEqual([]);
    });

    it('debe construir chip de estado inactiva correctamente', () => {
      (component as any).patchFilters({ enabled: 'false' });
      const chips: { filterKey: string; label: string }[] = (component as any)
        .activeChips;
      expect(chips[0].label).toBe('Estado: Inactiva');
    });
  });

  describe('onSearchValueChange', () => {
    it('debe actualizar el campo companyName del filtro', () => {
      (component as any).onSearchValueChange('Tech Corp');
      expect(component.filters().companyName).toBe('Tech Corp');
    });
  });

  describe('applyFilters', () => {
    it('debe navegar a /clients/companies/page/0 con queryParams cuando hay filtros', () => {
      (component as any).patchFilters({ taxId: '900123' });
      navigateSpy.mockClear();

      (component as any).applyFilters();

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/clients/companies/page', 0],
        expect.objectContaining({ queryParams: expect.any(Object) }),
      );
    });

    it('debe navegar a /clients/companies/page/0 sin queryParams cuando los filtros están vacíos', () => {
      navigateSpy.mockClear();

      (component as any).applyFilters();

      expect(navigateSpy).toHaveBeenCalledWith(['/clients/companies/page', 0]);
    });
  });

  describe('clearFilters', () => {
    it('debe resetear todos los filtros y navegar sin queryParams', () => {
      (component as any).patchFilters({ taxId: '900', city: 'Cali' });
      navigateSpy.mockClear();

      (component as any).clearFilters();

      const f = component.filters();
      expect(f.taxId).toBe('');
      expect(f.city).toBe('');
      expect(navigateSpy).toHaveBeenCalledWith(['/clients/companies/page', 0]);
    });
  });

  describe('removeFilter', () => {
    it('debe resetear solo el campo indicado y aplicar filtros', () => {
      (component as any).patchFilters({ taxId: '900', email: 'co@co.com' });
      navigateSpy.mockClear();

      (component as any).removeFilter('taxId');

      expect(component.filters().taxId).toBe('');
      expect(component.filters().email).toBe('co@co.com');
      expect(navigateSpy).toHaveBeenCalled();
    });
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { convertToParamMap, Router, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { PurchaseSaleListComponent } from './purchase-sale-list.component';
import { PurchaseSaleService } from '../../services/purchase-sale.service';
import { PurchaseSaleLookupService } from '../../services/purchase-sale-lookup.service';
import { PurchaseSaleReportService } from '../../services/purchase-sale-report.service';
import { PurchaseSaleUiHelperService } from '../../services/purchase-sale-ui-helper.service';
import { PurchaseSaleListManager } from '../../utils/purchase-sale-list-manager';
import { getDefaultUiFilters } from '../../utils/purchase-sale-filter.utils';

describe('PurchaseSaleListComponent', () => {
  let fixture: ComponentFixture<PurchaseSaleListComponent>;
  let component: PurchaseSaleListComponent;
  let navigateSpy: ReturnType<typeof vi.fn>;

  const paramMap$ = new BehaviorSubject(convertToParamMap({ page: '0' }));
  const queryParamMap$ = new BehaviorSubject(convertToParamMap({}));

  const mockLookupService = {
    clients: signal<unknown[]>([]),
    users: signal<unknown[]>([]),
    allVehicles: signal<unknown[]>([]),
    clientMap: signal(new Map<string, string>()),
    userMap: signal(new Map<string, string>()),
    vehicleMap: signal(new Map<string, string>()),
    allVehicleMap: signal(new Map<string, string>()),
    loadAll: () => {},
  };

  beforeEach(async () => {
    navigateSpy = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: PurchaseSaleService,
          useValue: {
            getAllPaginated: () => EMPTY,
            searchPaginated: () => EMPTY,
            getAllSimple: () => EMPTY,
          },
        },
        { provide: PurchaseSaleLookupService, useValue: mockLookupService },
        {
          provide: PurchaseSaleReportService,
          useValue: { export: () => EMPTY },
        },
        { provide: PurchaseSaleUiHelperService, useValue: {} },
        PurchaseSaleListManager,
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
      .overrideComponent(PurchaseSaleListComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PurchaseSaleListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('estado inicial de filtros', () => {
    it('los filtros deben coincidir con getDefaultUiFilters()', () => {
      expect(component.filters()).toEqual(getDefaultUiFilters());
    });

    it('contractType y contractStatus deben ser ALL por defecto', () => {
      expect(component.filters().contractType).toBe('ALL');
      expect(component.filters().contractStatus).toBe('ALL');
    });

    it('advancedFiltersCount debe ser 0', () => {
      expect((component as any).advancedFiltersCount).toBe(0);
    });
  });

  describe('patchFilters', () => {
    it('debe actualizar el campo indicado sin afectar los demás', () => {
      (component as any).patchFilters({ paymentMethod: 'CASH' });
      expect(component.filters().paymentMethod).toBe('CASH');
      expect(component.filters().contractType).toBe('ALL');
    });
  });

  describe('advancedFiltersCount', () => {
    it('debe contar filtros avanzados no vacíos o no ALL', () => {
      (component as any).patchFilters({
        paymentMethod: 'CASH',
        clientId: '1',
        userId: '2',
      });
      expect((component as any).advancedFiltersCount).toBe(3);
    });

    it('contractType distinto de ALL cuenta como filtro activo', () => {
      (component as any).patchFilters({ contractType: 'SALE' });
      expect((component as any).advancedFiltersCount).toBe(1);
    });

    it('el campo term no cuenta como filtro avanzado', () => {
      (component as any).patchFilters({ term: 'busqueda' });
      expect((component as any).advancedFiltersCount).toBe(0);
    });
  });

  describe('onSearchValueChange', () => {
    it('debe actualizar el campo term del filtro', () => {
      (component as any).onSearchValueChange('Toyota');
      expect(component.filters().term).toBe('Toyota');
    });
  });

  describe('applyFilters', () => {
    it('debe navegar a /purchase-sales/page/0', () => {
      navigateSpy.mockClear();

      (component as any).applyFilters();

      expect(navigateSpy).toHaveBeenCalledWith(
        ['/purchase-sales/page', 0],
        expect.any(Object),
      );
    });
  });

  describe('clearFilters', () => {
    it('debe resetear los filtros al estado por defecto y navegar sin queryParams', () => {
      (component as any).patchFilters({
        paymentMethod: 'CASH',
        contractType: 'SALE',
      });
      navigateSpy.mockClear();

      (component as any).clearFilters();

      expect(component.filters()).toEqual(getDefaultUiFilters());
      expect(navigateSpy).toHaveBeenCalledWith(['/purchase-sales/page', 0]);
    });
  });

  describe('removeFilter', () => {
    it('debe resetear solo el campo indicado al valor por defecto', () => {
      (component as any).patchFilters({
        paymentMethod: 'CASH',
        clientId: '42',
      });
      navigateSpy.mockClear();

      (component as any).removeFilter('paymentMethod');

      expect(component.filters().paymentMethod).toBe('');
      expect(component.filters().clientId).toBe('42');
      expect(navigateSpy).toHaveBeenCalled();
    });

    it('debe limpiar term al eliminar un filtro de entidad', () => {
      (component as any).patchFilters({ clientId: '42', term: 'busqueda' });
      navigateSpy.mockClear();

      (component as any).removeFilter('clientId');

      expect(component.filters().term).toBe('');
      expect(component.filters().clientId).toBe('');
    });
  });
});

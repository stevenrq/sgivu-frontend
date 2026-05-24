import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickSearchBarComponent } from './quick-search-bar.component';
import {
  QuickSuggestion,
  ActiveFilterChip,
} from '../../utils/quick-search.utils';

describe('QuickSearchBarComponent', () => {
  let fixture: ComponentFixture<QuickSearchBarComponent>;
  let component: QuickSearchBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickSearchBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickSearchBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('Debe crear el componente', () => {
    expect(component).toBeTruthy();
  });

  describe('renderizado inicial', () => {
    it('Debe mostrar el placeholder configurado', () => {
      fixture.componentRef.setInput('placeholder', 'Buscar por placa...');
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        'input[type="text"]',
      ) as HTMLInputElement;
      expect(input.placeholder).toBe('Buscar por placa...');
    });

    it('Debe ocultar el botón de limpiar cuando searchValue está vacío', () => {
      fixture.componentRef.setInput('searchValue', '');
      fixture.detectChanges();

      const clearBtn = fixture.nativeElement.querySelector(
        '.btn-outline-secondary',
      );
      expect(clearBtn).toBeNull();
    });

    it('Debe mostrar el botón de limpiar cuando searchValue tiene valor', () => {
      fixture.componentRef.setInput('searchValue', 'Honda');
      fixture.detectChanges();

      const clearBtn = fixture.nativeElement.querySelector(
        '.btn-outline-secondary',
      );
      expect(clearBtn).toBeTruthy();
    });

    it('Debe renderizar chips de filtros activos', () => {
      const chips: ActiveFilterChip[] = [
        { filterKey: 'brand', label: 'Marca: Honda' },
        { filterKey: 'status', label: 'Estado: Disponible' },
      ];
      fixture.componentRef.setInput('activeChips', chips);
      fixture.detectChanges();

      const chipElements = fixture.nativeElement.querySelectorAll(
        '.active-filter-chip',
      );
      expect(chipElements.length).toBe(2);
      expect(chipElements[0].textContent).toContain('Marca: Honda');
    });

    it('Debe ocultar la sección de chips cuando no hay filtros activos', () => {
      fixture.componentRef.setInput('activeChips', []);
      fixture.detectChanges();

      const chipsContainer = fixture.nativeElement.querySelector(
        '.active-filter-chip',
      );
      expect(chipsContainer).toBeNull();
    });
  });

  describe('onInput()', () => {
    it('Debe emitir searchValueChange al escribir', () => {
      const emitSpy = spyOn(component.searchValueChange, 'emit');

      component['onInput']('Honda');

      expect(emitSpy).toHaveBeenCalledWith('Honda');
    });

    it('Debe mostrar dropdown cuando hay sugerencias y el valor no está vacío', () => {
      const suggestions: QuickSuggestion[] = [
        { label: 'Cliente 1', context: 'cliente', type: 'client', value: '1' },
      ];
      fixture.componentRef.setInput('suggestions', suggestions);
      fixture.detectChanges();

      component['onInput']('Cli');
      expect(component['showDropdown']).toBeTrue();
    });

    it('Debe ocultar dropdown cuando el valor está vacío', () => {
      component['showDropdown'] = true;

      component['onInput']('');

      expect(component['showDropdown']).toBeFalse();
    });
  });

  describe('onKeyEnter()', () => {
    it('Debe emitir searchSubmitted y cerrar dropdown al presionar Enter', () => {
      const emitSpy = spyOn(component.searchSubmitted, 'emit');
      component['showDropdown'] = true;

      component['onKeyEnter']();

      expect(emitSpy).toHaveBeenCalled();
      expect(component['showDropdown']).toBeFalse();
    });
  });

  describe('onClear()', () => {
    it('Debe emitir searchValueChange con cadena vacía y cleared al limpiar', () => {
      const changeSpy = spyOn(component.searchValueChange, 'emit');
      const clearedSpy = spyOn(component.cleared, 'emit');
      component['showDropdown'] = true;

      component['onClear']();

      expect(changeSpy).toHaveBeenCalledWith('');
      expect(clearedSpy).toHaveBeenCalled();
      expect(component['showDropdown']).toBeFalse();
    });
  });

  describe('onSuggestionClick()', () => {
    it('Debe emitir suggestionSelected y cerrar el dropdown al seleccionar sugerencia', () => {
      const emitSpy = spyOn(component.suggestionSelected, 'emit');
      const suggestion: QuickSuggestion = {
        label: 'Cliente A',
        context: 'cliente',
        type: 'client',
        value: '42',
      };
      component['showDropdown'] = true;

      component['onSuggestionClick'](suggestion);

      expect(emitSpy).toHaveBeenCalledWith(suggestion);
      expect(component['showDropdown']).toBeFalse();
    });
  });

  describe('onChipRemove()', () => {
    it('Debe emitir el filterKey del chip al cerrarlo', () => {
      const emitSpy = spyOn(component.chipRemoved, 'emit');

      component['onChipRemove']('brand');

      expect(emitSpy).toHaveBeenCalledWith('brand');
    });
  });

  describe('onSearchIconClick()', () => {
    it('Debe emitir searchSubmitted al hacer clic en el ícono de búsqueda', () => {
      const emitSpy = spyOn(component.searchSubmitted, 'emit');

      component['onSearchIconClick']();

      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('dropdown de sugerencias', () => {
    it('Debe renderizar sugerencias cuando showDropdown es true y hay sugerencias', () => {
      const suggestions: QuickSuggestion[] = [
        {
          label: 'Honda CB160F',
          context: 'Motocicleta',
          type: 'vehicle',
          value: '5',
        },
        {
          label: 'Toyota Corolla',
          context: 'Automóvil',
          type: 'vehicle',
          value: '6',
        },
      ];
      fixture.componentRef.setInput('suggestions', suggestions);
      component['showDropdown'] = true;
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll(
        '.quick-search-dropdown .dropdown-item',
      );
      expect(items.length).toBe(2);
      expect(
        items[0].querySelector('.suggestion-label').textContent.trim(),
      ).toBe('Honda CB160F');
    });

    it('Debe ocultar el dropdown cuando showDropdown es false', () => {
      const suggestions: QuickSuggestion[] = [
        { label: 'Honda', context: 'Moto', type: 'vehicle', value: '1' },
      ];
      fixture.componentRef.setInput('suggestions', suggestions);
      component['showDropdown'] = false;
      fixture.detectChanges();

      const dropdown = fixture.nativeElement.querySelector(
        '.quick-search-dropdown',
      );
      expect(dropdown).toBeNull();
    });
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  FilterChipGroupComponent,
  ChipOption,
} from './filter-chip-group.component';

const STATUS_OPTIONS: ChipOption[] = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'SOLD', label: 'Vendido' },
  { value: 'INACTIVE', label: 'Inactivo' },
];

describe('FilterChipGroupComponent', () => {
  let fixture: ComponentFixture<FilterChipGroupComponent>;
  let component: FilterChipGroupComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterChipGroupComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterChipGroupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', STATUS_OPTIONS);
    fixture.detectChanges();
  });

  it('Debe crear el componente', () => {
    expect(component).toBeTruthy();
  });

  describe('renderizado', () => {
    it('Debe renderizar el chip "Todos" más un chip por cada opción', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button.chip-btn');
      expect(buttons.length).toBe(STATUS_OPTIONS.length + 1);
    });

    it('Debe mostrar la etiqueta cuando se configura el input label', () => {
      fixture.componentRef.setInput('label', 'Estado');
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.chip-group-label');
      expect(label.textContent.trim()).toBe('Estado');
    });

    it('Debe ocultar la etiqueta cuando label no está definido', () => {
      const label = fixture.nativeElement.querySelector('.chip-group-label');
      expect(label).toBeNull();
    });

    it('Debe marcar "Todos" como activo cuando selected es null', () => {
      fixture.componentRef.setInput('selected', null);
      fixture.detectChanges();

      const allBtn = fixture.nativeElement.querySelector('button.chip-btn');
      expect(allBtn.classList).toContain('active');
    });

    it('Debe marcar "Todos" como activo cuando selected coincide con allValue', () => {
      fixture.componentRef.setInput('allValue', '');
      fixture.componentRef.setInput('selected', '');
      fixture.detectChanges();

      const allBtn = fixture.nativeElement.querySelector('button.chip-btn');
      expect(allBtn.classList).toContain('active');
    });

    it('Debe marcar la opción seleccionada como activa', () => {
      fixture.componentRef.setInput('selected', 'SOLD');
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('button.chip-btn');
      // Índice 0 = "Todos", índice 2 = "Vendido"
      expect(buttons[2].classList).toContain('active');
      expect(buttons[0].classList).not.toContain('active');
    });
  });

  describe('onSelect()', () => {
    it('Debe emitir el valor al seleccionar una opción', () => {
      const emitSpy = spyOn(component.selectedChange, 'emit');

      component['onSelect']('AVAILABLE');

      expect(emitSpy).toHaveBeenCalledWith('AVAILABLE');
    });

    it('Debe emitir allValue al seleccionar la opción ya activa (toggle off)', () => {
      fixture.componentRef.setInput('selected', 'AVAILABLE');
      fixture.componentRef.setInput('allValue', '');
      fixture.detectChanges();

      const emitSpy = spyOn(component.selectedChange, 'emit');

      component['onSelect']('AVAILABLE');

      expect(emitSpy).toHaveBeenCalledWith('');
    });

    it('Debe emitir el valor al hacer clic en un chip distinto del activo', () => {
      fixture.componentRef.setInput('selected', 'AVAILABLE');
      fixture.detectChanges();

      const emitSpy = spyOn(component.selectedChange, 'emit');

      component['onSelect']('SOLD');

      expect(emitSpy).toHaveBeenCalledWith('SOLD');
    });

    it('Debe emitir allValue al hacer clic en el chip "Todos"', () => {
      fixture.componentRef.setInput('allValue', null);
      fixture.detectChanges();

      const emitSpy = spyOn(component.selectedChange, 'emit');

      component['onSelect'](null);

      expect(emitSpy).toHaveBeenCalledWith(null);
    });
  });

  describe('isAllSelected()', () => {
    it('Debe retornar true cuando selected es null', () => {
      fixture.componentRef.setInput('selected', null);
      fixture.detectChanges();

      expect(component['isAllSelected']()).toBeTrue();
    });

    it('Debe retornar true cuando selected es cadena vacía', () => {
      fixture.componentRef.setInput('selected', '');
      fixture.detectChanges();

      expect(component['isAllSelected']()).toBeTrue();
    });

    it('Debe retornar false cuando hay una opción seleccionada', () => {
      fixture.componentRef.setInput('selected', 'INACTIVE');
      fixture.detectChanges();

      expect(component['isAllSelected']()).toBeFalse();
    });
  });
});

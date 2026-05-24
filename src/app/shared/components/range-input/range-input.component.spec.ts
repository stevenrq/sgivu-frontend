import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RangeInputComponent } from './range-input.component';
import { SimpleChange } from '@angular/core';

describe('RangeInputComponent', () => {
  let fixture: ComponentFixture<RangeInputComponent>;
  let component: RangeInputComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RangeInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RangeInputComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Año');
    fixture.detectChanges();
  });

  it('Debe crear el componente', () => {
    expect(component).toBeTruthy();
  });

  describe('renderizado — modo numérico', () => {
    it('Debe renderizar la etiqueta del rango', () => {
      const legend = fixture.nativeElement.querySelector('legend');
      expect(legend.textContent.trim()).toBe('Año');
    });

    it('Debe renderizar dos inputs numéricos por defecto', () => {
      const inputs = fixture.nativeElement.querySelectorAll(
        'input[type="number"]',
      );
      expect(inputs.length).toBe(2);
    });

    it('Debe mostrar la unidad en el input-group-text cuando se configura unit', () => {
      fixture.componentRef.setInput('unit', 'km');
      fixture.detectChanges();

      const unitSpans =
        fixture.nativeElement.querySelectorAll('.input-group-text');
      const unitTexts = Array.from(unitSpans as NodeListOf<Element>).map((el) =>
        el.textContent?.trim(),
      );
      expect(unitTexts).toContain('km');
    });

    it('Debe omitir input-group-text de unidad cuando unit no está definido', () => {
      const inputs = fixture.nativeElement.querySelectorAll(
        'input[type="number"]',
      );
      const unitSpan = fixture.nativeElement.querySelector('.input-group-text');
      expect(inputs.length).toBe(2);
      expect(unitSpan).toBeNull();
    });
  });

  describe('renderizado — modo precio', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('inputType', 'price');
      fixture.detectChanges();
    });

    it('Debe renderizar inputs de texto con símbolo $ en modo precio', () => {
      const inputs =
        fixture.nativeElement.querySelectorAll('input[type="text"]');
      expect(inputs.length).toBe(2);

      const symbols =
        fixture.nativeElement.querySelectorAll('.input-group-text');
      expect(symbols.length).toBe(2);
      symbols.forEach((span: Element) =>
        expect(span.textContent?.trim()).toBe('$'),
      );
    });
  });

  describe('onNumberChange()', () => {
    it('Debe emitir el valor numérico al cambiar el input mínimo', () => {
      const emitSpy = spyOn(component.minValueChange, 'emit');

      component['onNumberChange']('min', '2020');

      expect(emitSpy).toHaveBeenCalledWith(2020);
    });

    it('Debe emitir el valor numérico al cambiar el input máximo', () => {
      const emitSpy = spyOn(component.maxValueChange, 'emit');

      component['onNumberChange']('max', '2024');

      expect(emitSpy).toHaveBeenCalledWith(2024);
    });

    it('Debe emitir null cuando el campo está vacío', () => {
      const emitSpy = spyOn(component.minValueChange, 'emit');

      component['onNumberChange']('min', '');

      expect(emitSpy).toHaveBeenCalledWith(null);
    });

    it('Debe emitir null cuando el valor no es numérico', () => {
      const emitSpy = spyOn(component.minValueChange, 'emit');

      component['onNumberChange']('min', 'abc');

      expect(emitSpy).toHaveBeenCalledWith(null);
    });
  });

  describe('onPriceInput()', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('inputType', 'price');
      fixture.detectChanges();
    });

    it('Debe emitir el valor numérico al ingresar precio mínimo', () => {
      const emitSpy = spyOn(component.minValueChange, 'emit');

      component['onPriceInput']('min', '1000000');

      expect(emitSpy).toHaveBeenCalledWith(1000000);
    });

    it('Debe emitir el valor numérico al ingresar precio máximo', () => {
      const emitSpy = spyOn(component.maxValueChange, 'emit');

      component['onPriceInput']('max', '5000000');

      expect(emitSpy).toHaveBeenCalledWith(5000000);
    });

    it('Debe emitir null cuando el campo de precio está vacío', () => {
      const emitSpy = spyOn(component.minValueChange, 'emit');

      component['onPriceInput']('min', '');

      expect(emitSpy).toHaveBeenCalledWith(null);
    });

    it('Debe actualizar el display con formato COP al ingresar un número', () => {
      component['onPriceInput']('min', '1500000');

      expect(component['displayMin']()).toBe('1.500.000');
    });
  });

  describe('ngOnChanges()', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('inputType', 'price');
      fixture.detectChanges();
    });

    it('Debe sincronizar displayMin con formato COP cuando minValue cambia a un número', () => {
      fixture.componentRef.setInput('minValue', 2000000);
      component.ngOnChanges({
        minValue: new SimpleChange(null, 2000000, false),
      });

      expect(component['displayMin']()).toBe('2.000.000');
    });

    it('Debe sincronizar displayMax con formato COP cuando maxValue cambia a un número', () => {
      fixture.componentRef.setInput('maxValue', 8000000);
      component.ngOnChanges({
        maxValue: new SimpleChange(null, 8000000, false),
      });

      expect(component['displayMax']()).toBe('8.000.000');
    });

    it('Debe establecer displayMin en cadena vacía cuando minValue cambia a null', () => {
      component.ngOnChanges({
        minValue: new SimpleChange(2000000, null, false),
      });

      expect(component['displayMin']()).toBe('');
    });

    it('Debe mostrar el valor como string cuando no es un número válido', () => {
      fixture.componentRef.setInput('minValue', '1.500.000');
      component.ngOnChanges({
        minValue: new SimpleChange(null, '1.500.000', false),
      });

      // "1.500.000" no es parseado por Number() como entero válido en JS → retorna el string
      expect(component['displayMin']()).toBe('1.500.000');
    });

    it('Debe ignorar cambios de precio cuando inputType es number', () => {
      fixture.componentRef.setInput('inputType', 'number');
      fixture.detectChanges();

      component['displayMin'].set('should-not-change');
      component.ngOnChanges({
        minValue: new SimpleChange(null, 500, false),
      });

      expect(component['displayMin']()).toBe('should-not-change');
    });
  });
});

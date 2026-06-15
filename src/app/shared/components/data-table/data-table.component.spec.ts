import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<DataTableComponent>;
  let component: DataTableComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('Debe crear el componente', () => {
    expect(component).toBeTruthy();
  });

  describe('configuración por defecto', () => {
    it('Debe renderizar una tabla compacta con scroll interno y encabezado fijo', () => {
      const tableContainer =
        fixture.nativeElement.querySelector('.table-container');
      const table = fixture.nativeElement.querySelector('table');
      const thead = fixture.nativeElement.querySelector('thead');

      expect(table.classList).toContain('table-sm');
      expect(tableContainer.style.maxHeight).toBe('480px');
      expect(tableContainer.style.overflowY).toBe('auto');
      expect(thead.classList).toContain('sticky-header');
    });
  });

  describe('personalización', () => {
    it('Debe permitir sobrescribir la altura máxima y desactivar la compactación', () => {
      fixture.componentRef.setInput('maxHeight', 320);
      fixture.componentRef.setInput('compact', false);
      fixture.detectChanges();

      const tableContainer =
        fixture.nativeElement.querySelector('.table-container');
      const table = fixture.nativeElement.querySelector('table');

      expect(tableContainer.style.maxHeight).toBe('320px');
      expect(tableContainer.style.overflowY).toBe('auto');
      expect(table.classList).not.toContain('table-sm');
    });
  });
});

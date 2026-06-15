import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListToolbarComponent } from './list-toolbar.component';

@Component({
  imports: [ListToolbarComponent],
  template: `
    <app-list-toolbar
      [advancedFiltersCount]="count"
      (applied)="appliedCount = appliedCount + 1"
    >
      <div advanced-filters id="panel-content">Campos avanzados</div>
    </app-list-toolbar>
  `,
})
class HostComponent {
  count = 0;
  appliedCount = 0;
}

describe('ListToolbarComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;
  let host: HostComponent;

  const panelWrapper = (): HTMLElement =>
    fixture.nativeElement.querySelector('.advanced-filters-panel')
      .parentElement as HTMLElement;

  const buttonByText = (text: string): HTMLButtonElement => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const match = buttons.find((b) => b.textContent?.includes(text));
    if (!match) throw new Error(`Botón no encontrado: ${text}`);
    return match;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('panel de filtros avanzados', () => {
    it('Debe ocultar el panel por defecto y proyectar el contenido', () => {
      expect(panelWrapper().hidden).toBe(true);
      expect(
        fixture.nativeElement.querySelector('#panel-content')?.textContent,
      ).toContain('Campos avanzados');
    });

    it('Debe alternar la visibilidad del panel al pulsar "Más filtros"', () => {
      const toggle = buttonByText('Más filtros');

      toggle.click();
      fixture.detectChanges();
      expect(panelWrapper().hidden).toBe(false);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      toggle.click();
      fixture.detectChanges();
      expect(panelWrapper().hidden).toBe(true);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('contador de filtros activos', () => {
    it('Debe no mostrar badge cuando no hay filtros avanzados activos', () => {
      expect(fixture.nativeElement.querySelector('.badge')).toBeNull();
    });

    it('Debe mostrar el badge con la cantidad cuando hay filtros activos', () => {
      host.count = 3;
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('.badge')?.textContent?.trim(),
      ).toBe('3');
    });
  });

  describe('applied', () => {
    it('Debe emitir applied al pulsar "Aplicar"', () => {
      buttonByText('Aplicar').click();
      fixture.detectChanges();

      expect(host.appliedCount).toBe(1);
    });
  });
});

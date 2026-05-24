import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let component: SidebarComponent;

  const configure = async (platformId: 'browser' | 'server' = 'browser') => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
  };

  const setViewport = (width: number) => {
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      value: width,
      writable: true,
    });
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('Debe crear el componente', async () => {
    await configure();
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('Debe cargar preferencia de colapso en desktop al inicializar', async () => {
    localStorage.setItem('sgivu.sidebar.collapsed.v1', 'true');
    setViewport(1280);
    await configure();

    fixture.detectChanges();

    expect(component.isMobileView()).toBeFalse();
    expect(component.isDesktopCollapsed()).toBeTrue();
  });

  it('Debe alternar colapso en desktop, persistir y emitir estado', async () => {
    setViewport(1280);
    await configure();
    fixture.detectChanges();

    const emitSpy = spyOn(component.sidebarCollapsedChange, 'emit');

    component.toggleDesktopSidebar();

    expect(component.isDesktopCollapsed()).toBeTrue();
    expect(localStorage.getItem('sgivu.sidebar.collapsed.v1')).toBe('true');
    expect(emitSpy).toHaveBeenCalledWith(true);
  });

  it('Debe ignorar toggle desktop cuando está en vista móvil', async () => {
    setViewport(768);
    await configure();
    fixture.detectChanges();

    const emitSpy = spyOn(component.sidebarCollapsedChange, 'emit');

    component.toggleDesktopSidebar();

    expect(component.isDesktopCollapsed()).toBeFalse();
    expect(localStorage.getItem('sgivu.sidebar.collapsed.v1')).toBeNull();
    expect(emitSpy).not.toHaveBeenCalledWith(true);
  });

  it('Debe alternar apertura del menú en móvil', async () => {
    setViewport(768);
    await configure();
    fixture.detectChanges();

    expect(component.isSidebarOpen()).toBeFalse();

    component.toggleSidebar();

    expect(component.isSidebarOpen()).toBeTrue();
  });

  it('Debe mantener menú abierto en desktop al invocar toggleSidebar', async () => {
    setViewport(1280);
    await configure();
    fixture.detectChanges();

    const initialState = component.isSidebarOpen();

    component.toggleSidebar();

    expect(component.isSidebarOpen()).toBe(initialState);
  });

  it('Debe cerrar menú y emitir no colapsado al pasar de desktop a móvil', async () => {
    setViewport(1280);
    await configure();
    fixture.detectChanges();

    const emitSpy = spyOn(component.sidebarCollapsedChange, 'emit');

    setViewport(768);
    component.onWindowResize();

    expect(component.isMobileView()).toBeTrue();
    expect(component.isSidebarOpen()).toBeFalse();
    expect(emitSpy).toHaveBeenCalledWith(false);
  });

  it('Debe renderizar botón desktop solo en vista de escritorio', async () => {
    setViewport(1280);
    await configure();
    fixture.detectChanges();

    const desktopButton = fixture.nativeElement.querySelector(
      '.sidebar-desktop-toggle',
    );
    expect(desktopButton).toBeTruthy();

    setViewport(768);
    component.onWindowResize();
    fixture.detectChanges();

    const mobileDesktopButton = fixture.nativeElement.querySelector(
      '.sidebar-desktop-toggle',
    );
    expect(mobileDesktopButton).toBeFalsy();
  });

  it('Debe inicializar en modo seguro de servidor sin acceder a browser APIs', async () => {
    await configure('server');
    fixture.detectChanges();

    expect(component.isMobileView()).toBeFalse();
    expect(component.isSidebarOpen()).toBeTrue();
    expect(component.isDesktopCollapsed()).toBeFalse();
  });
});

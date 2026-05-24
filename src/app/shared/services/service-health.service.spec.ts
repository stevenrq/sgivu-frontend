import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ServiceHealthService } from './service-health.service';
import { ToastService } from './toast.service';

describe('ServiceHealthService', () => {
  let service: ServiceHealthService;
  let httpMock: HttpTestingController;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let appRef: ApplicationRef;

  const flushEffects = () => appRef.tick();

  beforeEach(() => {
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', [
      'success',
      'error',
      'warning',
      'info',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    service = TestBed.inject(ServiceHealthService);
    httpMock = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
  });

  afterEach(() => {
    service._resetForTesting();
    httpMock.verify();
  });

  describe('markGatewayDown()', () => {
    it('Debe cambiar el estado del gateway a down y reflejar anyServiceDown', () => {
      service.markGatewayDown();

      expect(service.gatewayStatus()).toBe('down');
      expect(service.anyServiceDown()).toBeTrue();
      expect(service.bothServicesDown()).toBeFalse();
    });
  });

  describe('checkGatewayHealth()', () => {
    it('Debe marcar gateway up ante respuesta 2xx con status UP', () => {
      service.checkGatewayHealth().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/actuator/health`);
      expect(req.request.headers.has('X-Skip-Health-Interceptor')).toBeTrue();
      req.flush({ status: 'UP' });

      expect(service.gatewayStatus()).toBe('up');
    });

    it('Debe marcar gateway down ante error de red (status 0)', () => {
      service.checkGatewayHealth().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/actuator/health`);
      req.error(new ProgressEvent('error'), {
        status: 0,
        statusText: 'Unknown',
      });

      expect(service.gatewayStatus()).toBe('down');
    });

    it('Debe marcar gateway down ante respuesta 503', () => {
      service.checkGatewayHealth().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/actuator/health`);
      req.flush('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      });

      expect(service.gatewayStatus()).toBe('down');
    });
  });

  describe('checkAuthHealth()', () => {
    it('Debe marcar auth up ante 401 (gateway alcanza al auth)', () => {
      service.checkAuthHealth().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/session`);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(service.authStatus()).toBe('up');
    });

    it('Debe marcar auth down ante 503', () => {
      service.checkAuthHealth().subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/session`);
      req.flush('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      });

      expect(service.authStatus()).toBe('down');
    });
  });

  describe('toast de recuperación', () => {
    it('Debe disparar toast.success al pasar de down a up', () => {
      service.markGatewayDown();
      flushEffects();
      expect(toastSpy.success).not.toHaveBeenCalled();

      service.markGatewayUp();
      flushEffects();

      expect(toastSpy.success).toHaveBeenCalledWith('Conexión restablecida');

      // El effect arrancó polling al marcar down; flushear la petición pendiente.
      httpMock.match(`${environment.apiUrl}/actuator/health`).forEach((req) => {
        req.flush({ status: 'UP' });
      });
    });
  });
});

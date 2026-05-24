import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { ServiceHealthService } from '../services/service-health.service';
import { serviceHealthInterceptor } from './service-health.interceptor';

describe('serviceHealthInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let serviceHealth: jasmine.SpyObj<ServiceHealthService>;

  beforeEach(() => {
    serviceHealth = jasmine.createSpyObj<ServiceHealthService>(
      'ServiceHealthService',
      ['markGatewayDown', 'markGatewayUp', 'markAuthDown', 'markAuthUp'],
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([serviceHealthInterceptor])),
        provideHttpClientTesting(),
        { provide: ServiceHealthService, useValue: serviceHealth },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('cuando la URL no es del gateway', () => {
    it('No debe modificar el flujo ni marcar estado', () => {
      http.get('https://otro.example.com/data').subscribe({
        next: () => undefined,
        error: () => undefined,
      });
      const req = httpMock.expectOne('https://otro.example.com/data');
      req.flush({});

      expect(serviceHealth.markGatewayUp).not.toHaveBeenCalled();
      expect(serviceHealth.markGatewayDown).not.toHaveBeenCalled();
    });
  });

  describe('cuando el request lleva el header de skip', () => {
    it('No debe afectar al estado de salud', () => {
      http
        .get(`${environment.apiUrl}/actuator/health`, {
          headers: new HttpHeaders().set('X-Skip-Health-Interceptor', '1'),
        })
        .subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/actuator/health`);
      req.flush({ status: 'UP' });

      expect(serviceHealth.markGatewayUp).not.toHaveBeenCalled();
    });
  });

  describe('errores de red', () => {
    it('Debe marcar gateway down ante status 0', () => {
      http.get(`${environment.apiUrl}/v1/users`).subscribe({
        next: () => undefined,
        error: () => undefined,
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users`);
      req.error(new ProgressEvent('error'), {
        status: 0,
        statusText: 'Unknown',
      });

      expect(serviceHealth.markGatewayDown).toHaveBeenCalled();
    });

    it('Debe marcar gateway down ante 504', () => {
      http.get(`${environment.apiUrl}/v1/users`).subscribe({
        next: () => undefined,
        error: () => undefined,
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/v1/users`);
      req.flush('Gateway Timeout', {
        status: 504,
        statusText: 'Gateway Timeout',
      });

      expect(serviceHealth.markGatewayDown).toHaveBeenCalled();
    });
  });

  describe('errores 502/503 en rutas de auth', () => {
    it('Debe marcar auth down y NO gateway down', () => {
      http.get(`${environment.apiUrl}/auth/session`).subscribe({
        next: () => undefined,
        error: () => undefined,
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/session`);
      req.flush('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      });

      expect(serviceHealth.markAuthDown).toHaveBeenCalled();
      expect(serviceHealth.markGatewayDown).not.toHaveBeenCalled();
    });
  });

  describe('errores 502/503 en rutas de negocio', () => {
    it('Debe marcar gateway down', () => {
      http.get(`${environment.apiUrl}/v1/vehicles`).subscribe({
        next: () => undefined,
        error: () => undefined,
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/v1/vehicles`);
      req.flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });

      expect(serviceHealth.markGatewayDown).toHaveBeenCalled();
      expect(serviceHealth.markAuthDown).not.toHaveBeenCalled();
    });
  });

  describe('respuestas exitosas', () => {
    it('Debe marcar gateway up pero NO auth up (sesión Redis del gateway no prueba auth vivo)', () => {
      http.get(`${environment.apiUrl}/auth/session`).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/session`);
      req.flush({ authenticated: true });

      expect(serviceHealth.markGatewayUp).toHaveBeenCalled();
      expect(serviceHealth.markAuthUp).not.toHaveBeenCalled();
    });
  });

  describe('401 en rutas de auth', () => {
    it('Debe marcar gateway up pero NO auth up (el 401 puede venir del gateway directamente)', () => {
      http.get(`${environment.apiUrl}/auth/session`).subscribe({
        next: () => undefined,
        error: () => undefined,
      });
      const req = httpMock.expectOne(`${environment.apiUrl}/auth/session`);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(serviceHealth.markGatewayUp).toHaveBeenCalled();
      expect(serviceHealth.markAuthUp).not.toHaveBeenCalled();
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { DestroyRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PurchaseSaleLookupService } from './purchase-sale-lookup.service';
import { PurchaseSaleService } from './purchase-sale.service';
import { PersonService } from '../../clients/services/person.service';
import { CompanyService } from '../../clients/services/company.service';
import { UserService } from '../../users/services/user.service';
import { CarService } from '../../vehicles/services/car.service';
import { MotorcycleService } from '../../vehicles/services/motorcycle.service';
import { VehicleStatus } from '../../vehicles/models/vehicle-status.enum';

describe('PurchaseSaleLookupService', () => {
  let service: PurchaseSaleLookupService;
  let personServiceSpy: jasmine.SpyObj<PersonService>;
  let companyServiceSpy: jasmine.SpyObj<CompanyService>;
  let userServiceSpy: jasmine.SpyObj<UserService>;
  let carServiceSpy: jasmine.SpyObj<CarService>;
  let motorcycleServiceSpy: jasmine.SpyObj<MotorcycleService>;
  let purchaseSaleServiceSpy: jasmine.SpyObj<PurchaseSaleService>;
  let destroyRef: DestroyRef;

  const mockPersons = [
    { id: 1, firstName: 'Juan', lastName: 'Pérez', nationalId: 123456 },
  ] as any[];

  const mockCompanies = [
    { id: 2, companyName: 'Acme Corp', taxId: 900123 },
  ] as any[];

  const mockUsers = [
    { id: 1, firstName: 'Admin', lastName: 'User', username: 'admin' },
  ] as any[];

  const mockCars = [
    {
      id: 1,
      brand: 'Toyota',
      model: 'Corolla',
      plate: 'ABC123',
      status: VehicleStatus.AVAILABLE,
      line: 'Sedan',
      purchasePrice: 25000,
      createdAt: null,
      updatedAt: null,
    },
  ] as any[];

  const mockMotorcycles = [
    {
      id: 2,
      brand: 'Honda',
      model: 'CBR',
      plate: 'XYZ789',
      status: VehicleStatus.AVAILABLE,
      line: 'Sport',
      purchasePrice: 15000,
      createdAt: null,
      updatedAt: null,
    },
  ] as any[];

  beforeEach(() => {
    personServiceSpy = jasmine.createSpyObj('PersonService', ['getAll']);
    companyServiceSpy = jasmine.createSpyObj('CompanyService', ['getAll']);
    userServiceSpy = jasmine.createSpyObj('UserService', ['getAll']);
    carServiceSpy = jasmine.createSpyObj('CarService', ['getAll']);
    motorcycleServiceSpy = jasmine.createSpyObj('MotorcycleService', [
      'getAll',
    ]);
    purchaseSaleServiceSpy = jasmine.createSpyObj('PurchaseSaleService', [
      'getAvailableVehicleIds',
    ]);

    // Asegurar que availableIds$ emite para que forkJoin pueda completarse.
    purchaseSaleServiceSpy.getAvailableVehicleIds.and.returnValue(of([1, 2]));

    TestBed.configureTestingModule({
      providers: [
        PurchaseSaleLookupService,
        { provide: PersonService, useValue: personServiceSpy },
        { provide: CompanyService, useValue: companyServiceSpy },
        { provide: UserService, useValue: userServiceSpy },
        { provide: CarService, useValue: carServiceSpy },
        { provide: MotorcycleService, useValue: motorcycleServiceSpy },
        { provide: PurchaseSaleService, useValue: purchaseSaleServiceSpy },
      ],
    });

    service = TestBed.inject(PurchaseSaleLookupService);
    destroyRef = TestBed.inject(DestroyRef);
  });

  it('Debe ser instanciado', () => {
    expect(service).toBeTruthy();
  });

  describe('loadVehiclesOnly()', () => {
    it('Debe cargar vehículos combinando automóviles y motocicletas', async () => {
      carServiceSpy.getAll.and.returnValue(of(mockCars));
      motorcycleServiceSpy.getAll.and.returnValue(of(mockMotorcycles));

      service.loadVehiclesOnly(destroyRef);

      // Permitir que se ejecute la suscripción y actualice la señal.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const vehicles = service.vehicles();
      expect(vehicles.length).toBe(2);
      expect(vehicles.some((v) => v.type === 'CAR')).toBeTrue();
      expect(vehicles.some((v) => v.type === 'MOTORCYCLE')).toBeTrue();
    });

    it('Debe ordenar vehículos por label alfabéticamente', async () => {
      carServiceSpy.getAll.and.returnValue(of(mockCars));
      motorcycleServiceSpy.getAll.and.returnValue(of(mockMotorcycles));

      service.loadVehiclesOnly(destroyRef);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const vehicles = service.vehicles();
      for (let i = 1; i < vehicles.length; i++) {
        expect(
          vehicles[i - 1].label.localeCompare(vehicles[i].label),
        ).toBeLessThanOrEqual(0);
      }
    });

    it('Debe llamar callback de error cuando falla la carga', () => {
      carServiceSpy.getAll.and.returnValue(
        throwError(() => new Error('Network error')),
      );
      motorcycleServiceSpy.getAll.and.returnValue(of([]));

      const errorSpy = jasmine.createSpy('onError');

      service.loadVehiclesOnly(destroyRef, errorSpy);

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('loadAll()', () => {
    it('Debe cargar clientes, usuarios y vehículos', async () => {
      personServiceSpy.getAll.and.returnValue(of(mockPersons));
      companyServiceSpy.getAll.and.returnValue(of(mockCompanies));
      userServiceSpy.getAll.and.returnValue(of(mockUsers));
      carServiceSpy.getAll.and.returnValue(of(mockCars));
      motorcycleServiceSpy.getAll.and.returnValue(of(mockMotorcycles));

      service.loadAll(destroyRef);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(service.clients().length).toBe(2);
      expect(service.users().length).toBe(1);
      expect(service.vehicles().length).toBe(2);
    });

    it('Debe ordenar todas las listas por label', async () => {
      personServiceSpy.getAll.and.returnValue(of(mockPersons));
      companyServiceSpy.getAll.and.returnValue(of(mockCompanies));
      userServiceSpy.getAll.and.returnValue(of(mockUsers));
      carServiceSpy.getAll.and.returnValue(of(mockCars));
      motorcycleServiceSpy.getAll.and.returnValue(of(mockMotorcycles));

      service.loadAll(destroyRef);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const clients = service.clients();
      for (let i = 1; i < clients.length; i++) {
        expect(
          clients[i - 1].label.localeCompare(clients[i].label),
        ).toBeLessThanOrEqual(0);
      }
    });

    it('Debe llamar callback de error cuando falla la carga', () => {
      personServiceSpy.getAll.and.returnValue(
        throwError(() => new Error('fail')),
      );
      companyServiceSpy.getAll.and.returnValue(of([]));
      userServiceSpy.getAll.and.returnValue(of([]));
      carServiceSpy.getAll.and.returnValue(of([]));
      motorcycleServiceSpy.getAll.and.returnValue(of([]));

      const errorSpy = jasmine.createSpy('onError');

      service.loadAll(destroyRef, errorSpy);

      expect(errorSpy).toHaveBeenCalled();
    });

    it('Debe llamar callback onComplete al finalizar', async () => {
      personServiceSpy.getAll.and.returnValue(of(mockPersons));
      companyServiceSpy.getAll.and.returnValue(of(mockCompanies));
      userServiceSpy.getAll.and.returnValue(of(mockUsers));
      carServiceSpy.getAll.and.returnValue(of(mockCars));
      motorcycleServiceSpy.getAll.and.returnValue(of(mockMotorcycles));

      const completeSpy = jasmine.createSpy('onComplete');

      service.loadAll(destroyRef, undefined, completeSpy);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('computed maps', () => {
    beforeEach(async () => {
      personServiceSpy.getAll.and.returnValue(of(mockPersons));
      companyServiceSpy.getAll.and.returnValue(of(mockCompanies));
      userServiceSpy.getAll.and.returnValue(of(mockUsers));
      carServiceSpy.getAll.and.returnValue(of(mockCars));
      motorcycleServiceSpy.getAll.and.returnValue(of(mockMotorcycles));

      service.loadAll(destroyRef);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('Debe generar clientMap como Map indexado por id', () => {
      const map = service.clientMap();

      expect(map instanceof Map).toBeTrue();
      expect(map.size).toBe(2);
      expect(map.get(1)).toBeDefined();
      expect(map.get(2)).toBeDefined();
    });

    it('Debe generar userMap como Map indexado por id', () => {
      const map = service.userMap();

      expect(map instanceof Map).toBeTrue();
      expect(map.size).toBe(1);
      expect(map.get(1)).toBeDefined();
    });

    it('Debe generar vehicleMap como Map indexado por id', () => {
      const map = service.vehicleMap();

      expect(map instanceof Map).toBeTrue();
      expect(map.size).toBe(2);
      expect(map.get(1)).toBeDefined();
      expect(map.get(2)).toBeDefined();
    });
  });

  describe('buildAvailableVehicleOptions()', () => {
    it('Debe filtrar solo vehículos AVAILABLE y con IDs permitidos', () => {
      const cars = [
        { id: 1, status: VehicleStatus.AVAILABLE },
        { id: 2, status: VehicleStatus.SOLD },
      ] as any[];
      const motorcycles = [
        { id: 3, status: VehicleStatus.AVAILABLE },
        { id: 4, status: VehicleStatus.SOLD },
      ] as any[];

      const result = (service as any).buildAvailableVehicleOptions(
        cars,
        motorcycles,
        [1, 3],
      );

      expect(result.map((v: any) => v.id)).toEqual([1, 3]);
    });

    it('Debe retornar vacío si no hay IDs disponibles', () => {
      const cars = [{ id: 1, status: VehicleStatus.AVAILABLE }] as any[];
      const motorcycles = [{ id: 2, status: VehicleStatus.AVAILABLE }] as any[];

      const result = (service as any).buildAvailableVehicleOptions(
        cars,
        motorcycles,
        [],
      );

      expect(result.length).toBe(0);
    });
  });
});

import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, of, timeout } from 'rxjs';
import { PersonService } from '../../clients/services/person.service';
import { CompanyService } from '../../clients/services/company.service';
import { UserService } from '../../users/services/user.service';
import { CarService } from '../../vehicles/services/car.service';
import { MotorcycleService } from '../../vehicles/services/motorcycle.service';
import {
  ClientOption,
  mapCarsToVehicles,
  mapCompaniesToClients,
  mapMotorcyclesToVehicles,
  mapPersonsToClients,
  mapUsersToOptions,
  UserOption,
  VehicleOption,
} from '../models/purchase-sale-reference.model';
import { PurchaseSaleService } from './purchase-sale.service';
import { Car } from '../../vehicles/models/car.model';
import { Motorcycle } from '../../vehicles/models/motorcycle.model';

const sortByLabel = <T extends { label: string }>(a: T, b: T): number =>
  a.label.localeCompare(b.label);

/**
 * Servicio de datos de referencia para los formularios de compra-venta.
 * Carga y expone como Signals las listas de clientes, usuarios y vehículos disponibles
 * para poblar los selectores del formulario de creación de contratos.
 *
 * Los vehículos disponibles se filtran por estado `AVAILABLE` y se validan contra
 * el endpoint `available-vehicles` para evitar seleccionar vehículos con contratos activos.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseSaleLookupService {
  private readonly personService = inject(PersonService);
  private readonly companyService = inject(CompanyService);
  private readonly userService = inject(UserService);
  private readonly carService = inject(CarService);
  private readonly motorcycleService = inject(MotorcycleService);
  private readonly purchaseSaleService = inject(PurchaseSaleService);

  readonly clients = signal<ClientOption[]>([]);
  readonly users = signal<UserOption[]>([]);
  readonly vehicles = signal<VehicleOption[]>([]);
  /** Todos los vehículos del inventario sin filtro de disponibilidad — para búsqueda por nombre/marca. */
  readonly allVehicles = signal<VehicleOption[]>([]);

  readonly clientMap = computed(
    () => new Map<number, ClientOption>(this.clients().map((c) => [c.id, c])),
  );

  readonly userMap = computed(
    () => new Map<number, UserOption>(this.users().map((u) => [u.id, u])),
  );

  readonly vehicleMap = computed(
    () => new Map<number, VehicleOption>(this.vehicles().map((v) => [v.id, v])),
  );

  readonly allVehicleMap = computed(
    () =>
      new Map<number, VehicleOption>(this.allVehicles().map((v) => [v.id, v])),
  );

  readonly availableIds$ = this.purchaseSaleService
    .getAvailableVehicleIds()
    .pipe(
      timeout(2000),
      catchError((err) => {
        console.warn(
          'purchase-sale: el endpoint available-vehicles falló, usando filtrado solo por estado',
          err,
        );
        return of<number[] | null>(null);
      }),
    );

  private buildAvailableVehicleOptions(
    cars: Car[],
    motorcycles: Motorcycle[],
    availableVehicleIds: number[],
  ): VehicleOption[] {
    const idsSet = new Set(availableVehicleIds);
    return [
      ...mapCarsToVehicles(cars),
      ...mapMotorcyclesToVehicles(motorcycles),
    ].filter((v) => v.status === 'AVAILABLE' && idsSet.has(v.id));
  }

  /**
   * Carga solo los vehículos disponibles (para formularios de edición donde los demás datos ya están cargados).
   *
   * @param destroyRef - Referencia de destrucción para limpiar la suscripción automáticamente.
   * @param onError - Callback opcional invocado si la carga falla.
   */
  loadVehiclesOnly(
    destroyRef: DestroyRef,
    onError?: (err: unknown) => void,
  ): void {
    const vehicles$ = forkJoin([
      this.carService.getAll(),
      this.motorcycleService.getAll(),
      this.availableIds$,
    ]).pipe(
      map(([cars, motorcycles, availableVehicleIds]) => {
        if (availableVehicleIds === null) {
          return [
            ...mapCarsToVehicles(cars),
            ...mapMotorcyclesToVehicles(motorcycles),
          ].filter((v) => v.status === 'AVAILABLE');
        }
        return this.buildAvailableVehicleOptions(
          cars,
          motorcycles,
          availableVehicleIds,
        );
      }),
    );

    vehicles$.pipe(takeUntilDestroyed(destroyRef)).subscribe({
      next: (vehicleOptions) => {
        this.vehicles.set(vehicleOptions.slice().sort(sortByLabel));
      },
      error: (err) => onError?.(err),
    });
  }

  /**
   * Carga en paralelo todos los datos de referencia: clientes, usuarios y vehículos disponibles.
   * Usa `forkJoin` para optimizar el tiempo total de carga en el formulario de creación.
   *
   * @param destroyRef - Referencia de destrucción para limpiar la suscripción automáticamente.
   * @param onError - Callback opcional invocado si alguna carga falla.
   * @param onComplete - Callback opcional invocado cuando todas las cargas finalizan.
   */
  loadAll(
    destroyRef: DestroyRef,
    onError?: (err: unknown) => void,
    onComplete?: () => void,
  ): void {
    const clients$ = forkJoin([
      this.personService.getAll(),
      this.companyService.getAll(),
    ]).pipe(
      map(([persons, companies]) => {
        return [
          ...mapPersonsToClients(persons),
          ...mapCompaniesToClients(companies),
        ];
      }),
    );

    const users$ = this.userService.getAll().pipe(map(mapUsersToOptions));

    const vehicles$ = forkJoin([
      this.carService.getAll(),
      this.motorcycleService.getAll(),
      this.availableIds$,
    ]).pipe(
      map(([cars, motorcycles, availableVehicleIds]) => {
        if (availableVehicleIds === null) {
          return [
            ...mapCarsToVehicles(cars),
            ...mapMotorcyclesToVehicles(motorcycles),
          ].filter((v) => v.status === 'AVAILABLE');
        }
        return this.buildAvailableVehicleOptions(
          cars,
          motorcycles,
          availableVehicleIds,
        );
      }),
    );

    const allVehiclesForSearch$ = forkJoin([
      this.carService.getAll(),
      this.motorcycleService.getAll(),
    ]).pipe(
      map(([cars, motorcycles]) => [
        ...mapCarsToVehicles(cars),
        ...mapMotorcyclesToVehicles(motorcycles),
      ]),
    );

    forkJoin([clients$, users$, vehicles$, allVehiclesForSearch$])
      .pipe(
        finalize(() => onComplete?.()),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe({
        next: ([
          clientOptions,
          userOptions,
          vehicleOptions,
          allVehicleOptions,
        ]) => {
          this.clients.set(clientOptions.slice().sort(sortByLabel));
          this.users.set(userOptions.slice().sort(sortByLabel));
          this.vehicles.set(vehicleOptions.slice().sort(sortByLabel));
          this.allVehicles.set(allVehicleOptions.slice().sort(sortByLabel));
        },
        error: (err) => onError?.(err),
      });
  }
}

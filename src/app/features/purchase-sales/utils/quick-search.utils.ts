import { ContractStatus } from '../models/contract-status.enum';
import { ContractType } from '../models/contract-type.enum';
import {
  ClientOption,
  UserOption,
  VehicleOption,
} from '../models/purchase-sale-reference.model';
import {
  getContractTypeLabel,
  getStatusLabel,
} from '../models/contract-labels';
import { PurchaseSaleUiFilters } from './purchase-sale-filter.utils';
import { QuickSuggestion } from '../../../shared/utils/quick-search.utils';
export type { QuickSuggestion };

/** Tipo de entidad que originó una sugerencia para contratos de compraventa. */
export type QuickSuggestionType =
  | 'client'
  | 'user'
  | 'vehicle'
  | 'status'
  | 'type';

/**
 * Contexto necesario para generar sugerencias. Los `linked*Ids` son IDs de entidades
 * que aparecen en contratos existentes; se usan para filtrar sugerencias irrelevantes
 * (ej: clientes sin contratos no aparecen como sugerencia).
 */
interface QuickSearchContext {
  clients: ClientOption[];
  users: UserOption[];
  vehicles: VehicleOption[];
  linkedClientIds: Set<number>;
  linkedUserIds: Set<number>;
  linkedVehicleIds: Set<number>;
  contractStatuses: ContractStatus[];
  contractTypes: ContractType[];
}

const MAX_PER_GROUP = 3;
const MAX_SUGGESTIONS = 9;
const MIN_TERM_LENGTH = 2;

/**
 * Genera sugerencias de autocompletado buscando en clientes, usuarios, vehículos,
 * estados y tipos de contrato simultáneamente. Limita a 3 por grupo y 9 total
 * para no saturar el dropdown.
 *
 * @param term Término de búsqueda libre ingresado por el usuario.
 * @param ctx Contexto con datos de referencia para generar sugerencias relevantes.
 * @returns Lista de sugerencias para mostrar en el dropdown de búsqueda rápida.
 */
export function buildQuickSuggestions(
  term: string,
  ctx: QuickSearchContext,
): QuickSuggestion[] {
  const normalized = term.trim().toLowerCase();
  if (normalized.length < MIN_TERM_LENGTH) {
    return [];
  }

  const matches: QuickSuggestion[] = [];

  ctx.clients
    .filter(
      (c) => ctx.linkedClientIds.has(c.id) && includesTerm(c.label, normalized),
    )
    .slice(0, MAX_PER_GROUP)
    .forEach((c) =>
      matches.push({
        label: c.label,
        context: 'Cliente con contratos',
        type: 'client',
        value: c.id.toString(),
      }),
    );

  ctx.users
    .filter(
      (u) => ctx.linkedUserIds.has(u.id) && includesTerm(u.label, normalized),
    )
    .slice(0, MAX_PER_GROUP)
    .forEach((u) =>
      matches.push({
        label: u.label,
        context: 'Usuario con contratos',
        type: 'user',
        value: u.id.toString(),
      }),
    );

  ctx.vehicles
    .filter((v) => includesTerm(v.label, normalized))
    .slice(0, MAX_PER_GROUP)
    .forEach((v) =>
      matches.push({
        label: v.label,
        context: 'Vehículo en el inventario',
        type: 'vehicle',
        value: v.id.toString(),
      }),
    );

  ctx.contractStatuses
    .filter((s) => matchesStatus(s, normalized))
    .forEach((s) =>
      matches.push({
        label: getStatusLabel(s),
        context: 'Estado de contrato',
        type: 'status',
        value: s,
      }),
    );

  ctx.contractTypes
    .filter((t) => matchesType(t, normalized))
    .forEach((t) =>
      matches.push({
        label: getContractTypeLabel(t),
        context: 'Tipo de contrato',
        type: 'type',
        value: t,
      }),
    );

  return matches.slice(0, MAX_SUGGESTIONS);
}

/**
 * Intenta inferir filtros de entidad a partir del término de búsqueda libre.
 * Si el texto coincide con un vehículo/cliente/usuario vinculado a contratos,
 * pre-llena el filtro correspondiente para refinar la búsqueda automáticamente.
 *
 * @param filters Filtros de UI que se actualizarán con sugerencias inferidas.
 * @param ctx Contexto con datos de referencia para generar sugerencias relevantes.
 */
export function hintQuickSearchFilters(
  filters: PurchaseSaleUiFilters,
  ctx: QuickSearchContext,
): void {
  const rawTerm = (filters.term ?? '').trim();
  if (!rawTerm) {
    return;
  }

  const normalized = rawTerm.toLowerCase();

  // Prioridad: vehículo > cliente > usuario.
  // Se resuelve a lo sumo una entidad para evitar que la API filtre por
  // múltiples IDs simultáneamente y devuelva 0 resultados.
  const vehicleMatch = ctx.vehicles.find((v) =>
    includesTerm(v.label, normalized),
  );
  if (vehicleMatch && !filters.vehicleId) {
    filters.vehicleId = vehicleMatch.id.toString();
    filters.term = rawTerm;
    return;
  }

  const clientMatch = ctx.clients.find(
    (c) => ctx.linkedClientIds.has(c.id) && includesTerm(c.label, normalized),
  );
  if (clientMatch && !filters.clientId) {
    filters.clientId = clientMatch.id.toString();
    filters.term = rawTerm;
    return;
  }

  const userMatch = ctx.users.find(
    (u) => ctx.linkedUserIds.has(u.id) && includesTerm(u.label, normalized),
  );
  if (userMatch && !filters.userId) {
    filters.userId = userMatch.id.toString();
  }

  filters.term = rawTerm;
}

function includesTerm(value: string, normalizedTerm: string): boolean {
  return value.toLowerCase().includes(normalizedTerm);
}

function matchesStatus(
  status: ContractStatus,
  normalizedTerm: string,
): boolean {
  const label = getStatusLabel(status).toLowerCase();
  return (
    label.includes(normalizedTerm) ||
    status.toLowerCase().includes(normalizedTerm)
  );
}

function matchesType(type: ContractType, normalizedTerm: string): boolean {
  const label = getContractTypeLabel(type).toLowerCase();
  return (
    label.includes(normalizedTerm) ||
    type.toLowerCase().includes(normalizedTerm)
  );
}

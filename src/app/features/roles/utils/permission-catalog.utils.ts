import { Permission } from '../../../shared/models/permission.model';

/**
 * Permiso individual dentro de un grupo, enriquecido con la etiqueta legible de su acción.
 */
export interface CatalogPermission {
  /** Nombre completo del permiso (e.g., `user:read`). */
  name: string;
  /** Acción del permiso (parte después de `:`, e.g., `read`). */
  action: string;
  /** Etiqueta legible de la acción en español (e.g., `Ver`). */
  actionLabel: string;
  /** Descripción del permiso provista por el backend. */
  description: string;
}

/**
 * Grupo de permisos pertenecientes a un mismo recurso (parte antes de `:`).
 */
export interface PermissionGroup {
  /** Recurso del permiso (e.g., `user`). */
  resource: string;
  /** Etiqueta legible del recurso en español (e.g., `Usuarios`). */
  label: string;
  /** Permisos del recurso, ordenados por acción. */
  permissions: CatalogPermission[];
}

/** Etiquetas en español por recurso. */
export const RESOURCE_LABELS: Record<string, string> = {
  user: 'Usuarios',
  role: 'Roles',
  permission: 'Permisos',
  person: 'Personas',
  company: 'Empresas',
  vehicle: 'Vehículos',
  car: 'Autos',
  motorcycle: 'Motocicletas',
  purchase_sale: 'Compraventas',
  ml: 'Machine Learning',
};

/** Etiquetas en español por acción. */
export const ACTION_LABELS: Record<string, string> = {
  create: 'Crear',
  read: 'Ver',
  update: 'Editar',
  delete: 'Eliminar',
  predict: 'Predecir',
  retrain: 'Reentrenar',
  models: 'Modelos',
};

/** Orden preferido de los recursos en la interfaz. */
const RESOURCE_ORDER: readonly string[] = [
  'user',
  'role',
  'permission',
  'person',
  'company',
  'vehicle',
  'car',
  'motorcycle',
  'purchase_sale',
  'ml',
];

/** Orden preferido de las acciones dentro de un grupo. */
const ACTION_ORDER: readonly string[] = [
  'read',
  'create',
  'update',
  'delete',
  'predict',
  'retrain',
  'models',
];

/**
 * Devuelve la etiqueta legible de un recurso; usa el token crudo como respaldo.
 *
 * @param resource - Recurso del permiso (parte antes de `:`).
 * @returns Etiqueta en español o el recurso original si no está mapeado.
 */
export function resourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource;
}

/**
 * Devuelve la etiqueta legible de una acción; usa el token crudo como respaldo.
 *
 * @param action - Acción del permiso (parte después de `:`).
 * @returns Etiqueta en español o la acción original si no está mapeada.
 */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/**
 * Agrupa un catálogo plano de permisos por recurso, ordenando grupos y acciones
 * de forma estable y traduciendo recursos/acciones a etiquetas en español.
 * Los recursos o acciones desconocidos se renderizan con su token crudo y se
 * ubican al final, garantizando resiliencia ante nuevos permisos del backend.
 *
 * @param permissions - Catálogo plano (`Permission[]`) tal como lo entrega el backend.
 * @returns Grupos de permisos por recurso, listos para renderizar.
 */
export function groupPermissionsByResource(
  permissions: Permission[],
): PermissionGroup[] {
  const groups = new Map<string, CatalogPermission[]>();

  for (const permission of permissions) {
    const parts = permission.name.split(':');
    const resource = parts[0] ?? '';
    const action = parts[1] ?? '';

    const entry: CatalogPermission = {
      name: permission.name,
      action,
      actionLabel: actionLabel(action),
      description: permission.description,
    };

    const existing = groups.get(resource);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(resource, [entry]);
    }
  }

  return Array.from(groups.entries())
    .map(([resource, perms]) => ({
      resource,
      label: resourceLabel(resource),
      permissions: [...perms].sort(sortByAction),
    }))
    .sort(sortByResource);
}

/** Ordena recursos según `RESOURCE_ORDER`; los desconocidos van al final, alfabéticamente. */
function sortByResource(a: PermissionGroup, b: PermissionGroup): number {
  return (
    resourceRank(a.resource) - resourceRank(b.resource) ||
    a.resource.localeCompare(b.resource)
  );
}

/** Ordena acciones según `ACTION_ORDER`; las desconocidas van al final, alfabéticamente. */
function sortByAction(a: CatalogPermission, b: CatalogPermission): number {
  return (
    actionRank(a.action) - actionRank(b.action) ||
    a.action.localeCompare(b.action)
  );
}

function resourceRank(resource: string): number {
  const index = RESOURCE_ORDER.indexOf(resource);
  return index === -1 ? RESOURCE_ORDER.length : index;
}

function actionRank(action: string): number {
  const index = ACTION_ORDER.indexOf(action);
  return index === -1 ? ACTION_ORDER.length : index;
}

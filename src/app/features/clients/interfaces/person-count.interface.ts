/**
 * Totales de personas clasificadas por estado de habilitación.
 */
export interface PersonCount {
  activePersons: number;
  inactivePersons: number;
  totalPersons?: number;
}

/** Dirección física de un cliente (persona o empresa). */
export class Address {
  /** Identificador de la dirección (presente en modo edición). */
  id?: number;
  /** Nombre de la calle o avenida. */
  street!: string;
  /** Número de la propiedad en la calle. */
  number!: string;
  /** Ciudad donde se ubica la dirección. */
  city!: string;
}

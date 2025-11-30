/**
 * Payload para confirmar al backend que la imagen se subió exitosamente al bucket.
 */
export interface VehicleImageConfirmUploadRequest {
  fileName: string;
  contentType: string;
  size: number;
  key: string;
  primary?: boolean;
}

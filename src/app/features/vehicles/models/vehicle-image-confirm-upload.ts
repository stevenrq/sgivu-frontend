/** Payload de confirmación de subida. El backend registra la imagen en BD y genera la URL pública. */
export interface VehicleImageConfirmUploadRequest {
  fileName: string;
  contentType: string;
  size: number;
  /** Key S3 obtenido de la presigned URL; permite al backend vincular el objeto ya subido. */
  key: string;
  primary?: boolean;
}

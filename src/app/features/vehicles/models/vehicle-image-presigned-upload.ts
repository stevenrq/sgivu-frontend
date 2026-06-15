/** Solicitud para generar una presigned URL de S3. El backend usa `contentType` para configurar la URL firmada. */
export interface VehicleImagePresignedUploadRequest {
  contentType: string;
}

/** Respuesta con los datos necesarios para subir el archivo a S3 y luego confirmar la subida. */
export interface VehicleImagePresignedUploadResponse {
  /** Bucket S3 destino. */
  bucket: string;
  /** Key (ruta) del objeto en S3; se reutiliza en la confirmación. */
  key: string;
  /** URL prefirmada con permisos PUT temporales. */
  uploadUrl: string;
}

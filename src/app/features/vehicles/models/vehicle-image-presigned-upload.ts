/**
 * Petición para generar una URL de carga firmada de una imagen.
 */
export interface VehicleImagePresignedUploadRequest {
  contentType: string;
}

/**
 * Respuesta con los datos necesarios para subir la imagen y referenciarla luego.
 */
export interface VehicleImagePresignedUploadResponse {
  bucket: string;
  key: string;
  uploadUrl: string;
}

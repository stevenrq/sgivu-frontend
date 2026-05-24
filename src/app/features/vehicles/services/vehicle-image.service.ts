import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpBackend, HttpClient, HttpResponse } from '@angular/common/http';
import { VehicleImageResponse } from '../models/vehicle-image-response';
import {
  VehicleImagePresignedUploadRequest,
  VehicleImagePresignedUploadResponse,
} from '../models/vehicle-image-presigned-upload';
import { VehicleImageConfirmUploadRequest } from '../models/vehicle-image-confirm-upload';
import { defer, from } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Servicio de bajo nivel para el flujo de subida de imágenes a S3 en 3 pasos:
 * 1. Solicitar presigned URL al backend
 * 2. Subir el archivo directamente a S3
 * 3. Confirmar la subida al backend para registrar la imagen
 */
@Injectable({
  providedIn: 'root',
})
export class VehicleImageService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}/v1/vehicles`;

  /**
   * HttpClient sin interceptores. Se usa para subidas a S3 porque las presigned URLs
   * rechazan headers de autenticación que el `defaultOAuthInterceptor` añade.
   */
  private readonly rawHttp: HttpClient = new HttpClient(inject(HttpBackend));

  /**
   * Obtiene las imágenes registradas de un vehículo.
   *
   * @param vehicleId - Identificador del vehículo.
   * @returns Observable con la lista de imágenes del vehículo.
   */
  getImages(vehicleId: number) {
    return this.http.get<VehicleImageResponse[]>(
      `${this.apiUrl}/${vehicleId}/images`,
    );
  }

  /**
   * Solicita al backend una presigned URL para subir una imagen a S3.
   *
   * @param vehicleId - Identificador del vehículo.
   * @param contentType - Tipo MIME del archivo a subir (e.g., `'image/jpeg'`).
   * @returns Observable con la presigned URL y la clave S3 del archivo.
   */
  createPresignedUploadUrl(vehicleId: number, contentType: string) {
    const body: VehicleImagePresignedUploadRequest = { contentType };
    return this.http.post<VehicleImagePresignedUploadResponse>(
      `${this.apiUrl}/${vehicleId}/images/presigned-upload`,
      body,
    );
  }

  /**
   * Sube el archivo directamente a S3 usando la presigned URL.
   * Usa `fetch` nativo vía `uploadWithFetch` para controlar `credentials` y `mode`.
   *
   * @param url - Presigned URL de S3.
   * @param file - Archivo a subir.
   * @param contentType - Tipo MIME del archivo.
   * @returns Observable con el cuerpo de la respuesta de S3.
   */
  uploadToPresignedUrl(url: string, file: File, contentType: string) {
    return defer(() => from(this.uploadWithFetch(url, file, contentType))).pipe(
      map((resp) => resp.body ?? ''),
    );
  }

  /**
   * Confirma al backend que la subida a S3 fue exitosa y registra la imagen en la base de datos.
   *
   * @param vehicleId - Identificador del vehículo.
   * @param payload - Datos de confirmación: nombre, tipo, tamaño, clave S3 y si es primaria.
   * @returns Observable que completa al confirmar el registro.
   */
  confirmUpload(vehicleId: number, payload: VehicleImageConfirmUploadRequest) {
    return this.http.post(
      `${this.apiUrl}/${vehicleId}/images/confirm-upload`,
      payload,
    );
  }

  /**
   * Elimina una imagen de un vehículo (tanto en S3 como en la base de datos).
   *
   * @param vehicleId - Identificador del vehículo.
   * @param imageId - Identificador de la imagen a eliminar.
   * @returns Observable vacío que completa al eliminar.
   */
  deleteImage(vehicleId: number, imageId: number) {
    return this.http.delete<void>(
      `${this.apiUrl}/${vehicleId}/images/${imageId}`,
    );
  }

  /**
   * Usa `fetch` nativo en vez de `HttpClient` porque las presigned URLs de S3 requieren
   * `credentials: 'omit'` y `mode: 'cors'`, que `HttpClient` no permite configurar.
   */
  private async uploadWithFetch(
    url: string,
    file: File,
    contentType: string,
  ): Promise<HttpResponse<string>> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
    });

    const textBody = await response.text();

    if (!response.ok) {
      const error = new Error('Fallo en la subida de la imagen') as Error & {
        status?: number;
        error?: string;
      };
      error.status = response.status;
      error.error = textBody;
      throw error;
    }

    return new HttpResponse({
      status: response.status,
      body: textBody,
    });
  }
}

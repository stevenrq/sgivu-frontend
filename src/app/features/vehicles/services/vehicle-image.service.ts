import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { VehicleImageResponse } from '../models/vehicle-image-response';
import {
  VehicleImagePresignedUploadRequest,
  VehicleImagePresignedUploadResponse,
} from '../models/vehicle-image-presigned-upload';
import { VehicleImageConfirmUploadRequest } from '../models/vehicle-image-confirm-upload';
import { defer, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpResponse } from '@angular/common/http';

/**
 * @description Servicio especializado en gestión de imágenes de vehículos. Maneja pre-firmas S3 sin interferencia de interceptores para cumplir los requisitos de almacenamiento de inventario visual.
 */
@Injectable({
  providedIn: 'root',
})
export class VehicleImageService {
  private readonly apiUrl = `${environment.apiUrl}/v1/vehicles`;

  /**
   * Este cliente HTTP no utiliza los interceptores predeterminados,
   * que agregarían la cabecera de autorización.
   * La URL prefirmada de S3 no acepta la cabecera de autorización.
   */
  private readonly rawHttp: HttpClient;

  constructor(
    private readonly http: HttpClient,
    httpBackend: HttpBackend,
  ) {
    this.rawHttp = new HttpClient(httpBackend);
  }

  /**
   * @description Obtiene todas las imágenes asociadas a un vehículo para mostrar su historial fotográfico.
   * @param vehicleId Identificador del vehículo.
   * @returns Observable con la colección de imágenes.
   */
  getImages(vehicleId: number) {
    return this.http.get<VehicleImageResponse[]>(
      `${this.apiUrl}/${vehicleId}/images`,
    );
  }

  /**
   * @description Solicita al backend la URL prefirmada para subir una imagen directamente a S3.
   * @param vehicleId Identificador del vehículo.
   * @param contentType Tipo MIME del archivo a subir.
   * @returns Observable con la URL y campos requeridos por S3.
   */
  createPresignedUploadUrl(vehicleId: number, contentType: string) {
    const body: VehicleImagePresignedUploadRequest = { contentType };
    return this.http.post<VehicleImagePresignedUploadResponse>(
      `${this.apiUrl}/${vehicleId}/images/presigned-upload`,
      body,
    );
  }

  /**
   * @description Sube el archivo a la URL prefirmada sin pasar por interceptores para preservar la firma. Envuelve `fetch` en un observable para integrarse con la UI.
   * @param url URL prefirmada entregada por backend/S3.
   * @param file Archivo a subir.
   * @param contentType Tipo MIME declarado.
   * @returns Observable con el cuerpo de la respuesta (vacío en éxito).
   */
  uploadToPresignedUrl(url: string, file: File, contentType: string) {
    // Se usa fetch para evitar aborts del XHR y respetar exactamente la firma.
    return defer(() => from(this.uploadWithFetch(url, file, contentType))).pipe(
      map((resp) => resp.body ?? ''),
    );
  }

  /**
   * @description Confirma al backend que la imagen se subió correctamente y debe asociarse al vehículo.
   * @param vehicleId Identificador del vehículo.
   * @param payload Datos de confirmación (nombre/key, metadatos).
   * @returns Observable vacío cuando se completa.
   */
  confirmUpload(vehicleId: number, payload: VehicleImageConfirmUploadRequest) {
    return this.http.post(
      `${this.apiUrl}/${vehicleId}/images/confirm-upload`,
      payload,
    );
  }

  /**
   * @description Elimina una imagen ya vinculada a un vehículo, liberando almacenamiento y evitando referencias obsoletas en la UI.
   * @param vehicleId Identificador del vehículo.
   * @param imageId Identificador interno de la imagen.
   * @returns Observable vacío al completar.
   */
  deleteImage(vehicleId: number, imageId: number) {
    return this.http.delete<void>(
      `${this.apiUrl}/${vehicleId}/images/${imageId}`,
    );
  }

  // Uso explícito de fetch para evitar que los interceptores de Angular modifiquen headers que invaliden la firma S3.
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
      const error: any = new Error('Upload failed via fetch');
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

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
 * Gestiona el ciclo de imágenes de vehículos con URLs prefirmadas de S3.
 * Combina un cliente con interceptores para las llamadas de negocio y otro
 * sin ellos para evitar cabeceras que invaliden las firmas prefirmadas.
 */
@Injectable({
  providedIn: 'root',
})
export class VehicleImageService {
  private readonly apiUrl = `${environment.apiUrl}/v1/vehicles`;

  /**
   * Cliente sin interceptores; evita que Authorization arruine la firma de S3.
   */
  private readonly rawHttp: HttpClient;

  constructor(
    private readonly http: HttpClient,
    httpBackend: HttpBackend,
  ) {
    this.rawHttp = new HttpClient(httpBackend);
  }

  getImages(vehicleId: number) {
    return this.http.get<VehicleImageResponse[]>(
      `${this.apiUrl}/${vehicleId}/images`,
    );
  }

  createPresignedUploadUrl(vehicleId: number, contentType: string) {
    const body: VehicleImagePresignedUploadRequest = { contentType };
    return this.http.post<VehicleImagePresignedUploadResponse>(
      `${this.apiUrl}/${vehicleId}/images/presigned-upload`,
      body,
    );
  }

  /**
   * Sube el archivo a la URL prefirmada sin pasar por interceptores para preservar la firma.
   * Envuelve `fetch` en un observable para integrarse con la UI.
   */
  uploadToPresignedUrl(url: string, file: File, contentType: string) {
    return defer(() => from(this.uploadWithFetch(url, file, contentType))).pipe(
      map((resp) => resp.body ?? ''),
    );
  }

  confirmUpload(vehicleId: number, payload: VehicleImageConfirmUploadRequest) {
    return this.http.post(
      `${this.apiUrl}/${vehicleId}/images/confirm-upload`,
      payload,
    );
  }

  deleteImage(vehicleId: number, imageId: number) {
    return this.http.delete<void>(
      `${this.apiUrl}/${vehicleId}/images/${imageId}`,
    );
  }

  /**
   * Usa `fetch` en lugar de `HttpClient` para respetar la firma de S3,
   * evitando que los interceptores agreguen cabeceras que invaliden la
   * solicitud. También controla manualmente los errores para entregar
   * contexto al suscriptor.
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

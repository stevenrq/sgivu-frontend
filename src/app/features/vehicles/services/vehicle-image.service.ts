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

  uploadToPresignedUrl(url: string, file: File, contentType: string) {
    // Se usa fetch para evitar aborts del XHR y respetar exactamente la firma.
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

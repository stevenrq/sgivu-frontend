import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VehicleImageService } from './vehicle-image.service';
import { VehicleImageResponse } from '../models/vehicle-image-response';
import {
  showAlert,
  showErrorAlert,
  showSuccessAlert,
} from '../../../shared/utils/swal-alert.utils';

/**
 * Servicio que encapsula la lógica de subida y eliminación de imágenes de vehículos.
 * Orquesta: presigned URL → upload a S3 → confirmación, con reintentos automáticos.
 */
@Injectable({
  providedIn: 'root',
})
export class VehicleImageUploadService {
  private readonly vehicleImageService = inject(VehicleImageService);

  readonly uploading = signal(false);

  /**
   * Valida y retorna los archivos de imagen seleccionados.
   * Retorna null si la selección es inválida.
   *
   * @param event - Evento de selección de archivos.
   * @returns Objeto con archivos válidos y URL de previsualización, o null.
   */

  processFileSelection(event: Event): {
    files: File[];
    previewUrl: string;
  } | null {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return null;
    }

    const files = Array.from(input.files);
    const onlyImages = files.filter((f) => f.type.startsWith('image/'));

    if (onlyImages.length !== files.length) {
      void showAlert({
        icon: 'warning',
        title: 'Archivo no válido',
        text: 'Por favor selecciona imágenes (JPEG, PNG, WEBP).',
      });
      input.value = '';
      return null;
    }

    return {
      files: onlyImages,
      previewUrl: URL.createObjectURL(onlyImages[0]),
    };
  }

  /**
   * Sube una lista de archivos al vehículo indicado.
   * Maneja reintentos, alertas de éxito/error, y actualiza la lista de imágenes.
   *
   * @param vehicleId - ID del vehículo al que se subirán las imágenes.
   * @param files - Lista de archivos a subir.
   * @param currentImages - Imágenes actuales del vehículo para determinar la primaria.
   * @returns Objeto indicando si la subida fue exitosa.
   */
  async uploadFiles(
    vehicleId: number,
    files: File[],
    currentImages: VehicleImageResponse[],
  ): Promise<{ success: boolean }> {
    if (!files.length) {
      void showAlert({
        icon: 'info',
        title: 'Sin imagen seleccionada',
        text: 'Selecciona una o varias imágenes antes de subirlas.',
      });
      return { success: false };
    }

    this.uploading.set(true);
    try {
      const hasImages = currentImages.length > 0;
      for (let idx = 0; idx < files.length; idx++) {
        const primary = !hasImages && idx === 0 && currentImages.length === 0;
        await this.uploadSingleFile(vehicleId, files[idx], 1, primary);
      }

      void showSuccessAlert('Las imágenes se han almacenado correctamente.');
      return { success: true };
    } catch (error: unknown) {
      this.handleUploadError(error);
      return { success: false };
    } finally {
      this.uploading.set(false);
    }
  }

  /**
   * Elimina una imagen del vehículo. Retorna true si se eliminó correctamente.
   *
   * @param vehicleId - ID del vehículo.
   * @param imageId - ID de la imagen a eliminar.
   * @returns `true` si la imagen fue eliminada exitosamente, `false` en caso contrario.
   */
  async deleteImage(vehicleId: number, imageId: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.vehicleImageService.deleteImage(vehicleId, imageId),
      );
      return true;
    } catch (error: unknown) {
      const errWithProps = error as { status?: number };
      const text =
        errWithProps?.status === 503
          ? 'El servicio de almacenamiento no está disponible en este momento. Intenta más tarde.'
          : 'Ocurrió un problema al eliminar la imagen.';
      void showAlert({ icon: 'error', title: 'No se pudo eliminar', text });
      return false;
    }
  }

  private async uploadSingleFile(
    vehicleId: number,
    file: File,
    attempt: number,
    primary: boolean,
  ): Promise<void> {
    const contentType = this.resolveContentType(file);
    try {
      const presigned = await firstValueFrom(
        this.vehicleImageService.createPresignedUploadUrl(
          vehicleId,
          contentType,
        ),
      );

      await firstValueFrom(
        this.vehicleImageService.uploadToPresignedUrl(
          presigned.uploadUrl,
          file,
          contentType,
        ),
      );

      await firstValueFrom(
        this.vehicleImageService.confirmUpload(vehicleId, {
          fileName: file.name,
          contentType,
          size: file.size,
          key: presigned.key,
          primary,
        }),
      );
    } catch (err: unknown) {
      if (attempt === 1 && this.shouldRetryUpload(err as Error)) {
        return this.uploadSingleFile(vehicleId, file, 2, primary);
      }
      throw err;
    }
  }

  private resolveContentType(file: File): string {
    return file.type === 'image/jpg' ? 'image/jpeg' : file.type || 'image/jpeg';
  }

  private shouldRetryUpload(error: Error): boolean {
    const errWithProps = error as Error & { status?: number; error?: string };
    if (errWithProps?.status === 0) return true;
    const msg =
      typeof errWithProps?.error === 'string' ? errWithProps.error : '';
    return (
      msg.includes('SignatureDoesNotMatch') ||
      msg.includes('MissingContentLength') ||
      msg.includes('expired') ||
      msg.includes('Request has expired')
    );
  }

  private handleUploadError(error: unknown): void {
    const errWithProps = error as Error & { status?: number; error?: string };

    // S3 no disponible desde el backend (503)
    if (errWithProps?.status === 503) {
      void showErrorAlert(
        'El servicio de almacenamiento no está disponible en este momento. Intenta más tarde.',
      );
      return;
    }

    const isS3XmlError =
      typeof errWithProps?.error === 'string' &&
      errWithProps.error.startsWith('<?xml');

    // S3 rechaza la subida por credenciales o permisos inválidos (403)
    if (isS3XmlError && errWithProps?.status === 403) {
      void showErrorAlert(
        'El servicio de almacenamiento no está disponible en este momento. Intenta más tarde.',
      );
      return;
    }

    const s3Message = isS3XmlError
      ? 'El enlace de subida expiró o la firma no es válida. Genera una nueva URL e inténtalo de nuevo.'
      : '';
    const duplicateMessage =
      typeof errWithProps?.error === 'string' &&
      (errWithProps.error.includes(
        'Ya existe una imagen con el mismo nombre de archivo',
      ) ||
        errWithProps.error.includes(
          'Ya existe una imagen registrada con esta clave',
        ))
        ? 'Ya existe una imagen con ese nombre o clave para este vehículo.'
        : '';
    const text =
      errWithProps?.status === 0
        ? 'No se pudo contactar con el bucket de almacenamiento. Verifica la conexión y la configuración de CORS.'
        : duplicateMessage ||
          s3Message ||
          'Ocurrió un problema al subir la imagen. Intenta nuevamente.';

    void showErrorAlert(text);
  }
}

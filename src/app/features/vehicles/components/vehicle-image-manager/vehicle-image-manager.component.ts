import { DecimalPipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { showConfirmDialog } from '../../../../shared/utils/swal-alert.utils';
import { VehicleImageResponse } from '../../models/vehicle-image-response';
import { VehicleImageService } from '../../services/vehicle-image.service';
import { VehicleImageUploadService } from '../../services/vehicle-image-upload.service';

/**
 * Gestor de fotografías de un vehículo (solo en modo edición).
 *
 * Es dueño del ciclo completo: selección de archivos con preview, subida vía
 * URLs prefirmadas (`VehicleImageUploadService`), listado y eliminación con
 * confirmación. Carga las imágenes automáticamente cuando recibe `vehicleId`
 * y notifica `busyChange` mientras hay una subida en curso para que el
 * formulario padre muestre su overlay de carga.
 */
@Component({
  selector: 'app-vehicle-image-manager',
  imports: [DecimalPipe, NgClass],
  templateUrl: './vehicle-image-manager.component.html',
  styleUrl: './vehicle-image-manager.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleImageManagerComponent {
  private readonly vehicleImageService = inject(VehicleImageService);
  private readonly imageUploadService = inject(VehicleImageUploadService);
  private readonly destroyRef = inject(DestroyRef);

  /** Identificador del vehículo cuyas imágenes se gestionan. */
  readonly vehicleId = input<number | null>(null);

  /** `true` mientras hay una subida en curso (el padre muestra su overlay). */
  readonly busyChange = output<boolean>();

  readonly vehicleImages = signal<VehicleImageResponse[]>([]);
  readonly selectedFiles = signal<File[]>([]);
  readonly previewUrl = signal<string | null>(null);
  readonly uploading = signal(false);

  constructor() {
    effect(() => {
      const id = this.vehicleId();
      if (id !== null) {
        this.loadVehicleImages(id);
      } else {
        this.vehicleImages.set([]);
      }
    });
  }

  onImageSelected(event: Event): void {
    const result = this.imageUploadService.processFileSelection(event);
    if (!result) {
      this.selectedFiles.set([]);
      this.previewUrl.set(null);
      return;
    }

    const currentPreview = this.previewUrl();
    if (currentPreview) URL.revokeObjectURL(currentPreview);
    this.selectedFiles.set(result.files);
    this.previewUrl.set(result.previewUrl);
  }

  async uploadSelectedImage(): Promise<void> {
    const vehicleId = this.vehicleId();
    if (!vehicleId) return;

    this.uploading.set(true);
    this.busyChange.emit(true);
    const { success } = await this.imageUploadService.uploadFiles(
      vehicleId,
      this.selectedFiles(),
      this.vehicleImages(),
    );
    this.uploading.set(false);
    this.busyChange.emit(false);

    if (success) {
      this.selectedFiles.set([]);
      const currentPreview = this.previewUrl();
      if (currentPreview) URL.revokeObjectURL(currentPreview);
      this.previewUrl.set(null);
      this.loadVehicleImages(vehicleId);
    }
  }

  removeSelectedFile(index: number): void {
    const files = this.selectedFiles();
    if (index < 0 || index >= files.length) return;
    const updated = files.filter((_, i) => i !== index);
    this.selectedFiles.set(updated);
    const currentPreview = this.previewUrl();
    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
      this.previewUrl.set(updated[0] ? URL.createObjectURL(updated[0]) : null);
    }
  }

  async deleteImage(imageId: number): Promise<void> {
    const vehicleId = this.vehicleId();
    if (!vehicleId) return;

    const result = await showConfirmDialog({
      title: 'Eliminar imagen',
      text: '¿Estás seguro de eliminar esta imagen?',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
    });

    if (!result.isConfirmed) return;

    const deleted = await this.imageUploadService.deleteImage(
      vehicleId,
      imageId,
    );
    if (deleted) {
      this.loadVehicleImages(vehicleId);
    }
  }

  private loadVehicleImages(vehicleId: number): void {
    this.vehicleImageService
      .getImages(vehicleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (images) => this.vehicleImages.set(images),
        error: () => console.error('Failed to load images'),
      });
  }
}

export interface VehicleImageConfirmUploadRequest {
  fileName: string;
  contentType: string;
  size: number;
  key: string;
  primary?: boolean;
}

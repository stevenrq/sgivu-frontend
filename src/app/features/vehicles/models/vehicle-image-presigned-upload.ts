export interface VehicleImagePresignedUploadRequest {
  contentType: string;
}

export interface VehicleImagePresignedUploadResponse {
  bucket: string;
  key: string;
  uploadUrl: string;
}

import { createApiClient } from "../shared/api/client";

type UploadInitPayload = {
  description?: string;
  mime?: string;
  size: number;
  filename?: string;
};

type UploadInitResponse = {
  uploadId?: string;
  imageId?: string;
};

type UploadStatusResponse = {
  status?: string;
  matchedImageId?: string | null;
  rejectReason?: string;
};

export const createUploadsApi = (apiBaseUrl = "") => {
  const api = createApiClient(apiBaseUrl);
  return {
    initUpload: (payload: UploadInitPayload) =>
      api.post<UploadInitResponse>("/api/v1/uploads/init", JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      }),
    completeUpload: (formData: FormData) =>
      api.post("/api/v1/uploads/complete", formData, {
        headers: {},
      }),
    getUploadStatus: (uploadId: string) =>
      api.get<UploadStatusResponse>(`/api/v1/uploads/${uploadId}/status`),
  };
};

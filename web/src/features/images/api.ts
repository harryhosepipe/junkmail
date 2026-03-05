import { createApiClient } from "../shared/api/client";

type ImageSummary = {
  id?: string;
  imageId?: string;
  status?: string;
  title?: string;
  description?: string;
  originalUrl?: string;
  thumb_url?: string;
  variantUrls?: unknown;
  createdAt?: string;
  uploaderAlias?: string | null;
  score?: number;
  votes?: number;
  comparisonsCount?: number;
};

type RecentImagesResponse = {
  items?: ImageSummary[];
};

export const createImagesApi = (apiBaseUrl = "") => {
  const api = createApiClient(apiBaseUrl);
  return {
    getImageById: (imageId: string) => api.get<ImageSummary>(`/api/v1/images/${imageId}`),
    getRecentImages: (limit = 8) =>
      api.get<RecentImagesResponse>(`/api/v1/images/recent?limit=${limit}`),
    getTopImages: (limit = 20, min = 0) =>
      api.get<ImageSummary[]>(`/api/v1/images/top?limit=${limit}&min=${min}`),
    uploadLegacyImage: (formData: FormData) => api.post<ImageSummary>("/api/v1/images", formData),
  };
};

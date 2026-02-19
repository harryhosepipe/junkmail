export type ImageUploadCreated = {
  kind: "created";
  id: string;
  status: "processing";
  originalUrl: string;
};

export type ImageUploadDuplicate = {
  kind: "duplicate";
  id: string;
  status: string;
  originalUrl: string;
  duplicateType: "exact" | "near";
  duplicateMessage: string;
  existing: {
    id: string;
    status: string;
    originalUrl: string;
    title: string | null;
    createdAt: string;
    uploaderAlias: string | null;
  };
};

export type ImageUploadDomainResult = ImageUploadCreated | ImageUploadDuplicate;

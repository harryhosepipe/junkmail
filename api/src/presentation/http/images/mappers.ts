import type { ImageUploadDomainResult } from "../../../domain/images/types.js";
import type { HttpStatus } from "../../../http/status.js";

type ImageUploadHttpResponse = {
  status: HttpStatus;
  body: Record<string, unknown>;
};

export const mapImageUploadDomainToHttp = (
  result: ImageUploadDomainResult,
): ImageUploadHttpResponse => {
  if (result.kind === "created") {
    return {
      status: 201,
      body: {
        id: result.id,
        status: result.status,
        originalUrl: result.originalUrl,
        duplicate: false,
        duplicateType: null,
      },
    };
  }

  return {
    status: result.duplicateType === "near" ? 409 : 200,
    body: {
      id: result.id,
      status: result.status,
      originalUrl: result.originalUrl,
      duplicate: true,
      duplicateType: result.duplicateType,
      error: { message: result.duplicateMessage },
      existing: result.existing,
    },
  };
};

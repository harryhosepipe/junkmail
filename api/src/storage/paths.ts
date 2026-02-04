export type ImageSize = "thumb" | "feed" | "full";
export type ImageFormat = "avif" | "webp" | "jpg" | "png";

export const imageBasePath = (imageId: string) => `images/${imageId}`;

export const originalKey = (imageId: string, ext: "jpg" | "png") =>
  `${imageBasePath(imageId)}/original.${ext}`;

export const variantKey = (imageId: string, size: ImageSize, format: ImageFormat) =>
  `${imageBasePath(imageId)}/${size}.${format}`;

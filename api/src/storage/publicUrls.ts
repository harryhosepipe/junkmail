import { storageBucket } from "./client.js";

const endpoint = process.env.MINIO_ENDPOINT || "localhost";
const port = process.env.MINIO_PORT || "9010";
const useSsl = process.env.MINIO_USE_SSL === "true";
const protocol = useSsl ? "https" : "http";

const minioDirectBase = `${protocol}://${endpoint}:${port}`;
const configuredPublicBase = process.env.MINIO_PUBLIC_URL || minioDirectBase;
const assetsProxyBase = (process.env.ASSETS_PROXY_BASE || "/assets").replace(/\/+$/, "");

const toPathname = (rawUrl: string) => {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("/")) {
    return rawUrl.split("?")[0] || "";
  }
  try {
    return new URL(rawUrl).pathname || "";
  } catch {
    return "";
  }
};

const shouldRewriteToProxy = (rawUrl: string, pathname: string) => {
  if (!pathname.startsWith(`/${storageBucket}/`)) {
    return false;
  }

  if (rawUrl.startsWith(`${assetsProxyBase}/`)) {
    return false;
  }

  if (rawUrl.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(rawUrl);
    const knownBases = [configuredPublicBase, minioDirectBase]
      .map((value) => {
        try {
          return new URL(value).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    return knownBases.includes(parsed.origin);
  } catch {
    return false;
  }
};

export const normalizePublicAssetUrl = (rawUrl: string) => {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;
  const pathname = toPathname(rawUrl);
  if (!pathname) return rawUrl;
  if (!shouldRewriteToProxy(rawUrl, pathname)) {
    return rawUrl;
  }
  return `${assetsProxyBase}${pathname}`;
};

export const normalizePublicAssetData = <T>(value: T): T => {
  if (typeof value === "string") {
    return normalizePublicAssetUrl(value) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizePublicAssetData(item)) as T;
  }

  const mapped = Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
    (acc, [key, entry]) => {
      acc[key] = normalizePublicAssetData(entry);
      return acc;
    },
    {},
  );

  return mapped as T;
};

export const extractStorageObjectKey = (publicUrl: string) => {
  if (!publicUrl || typeof publicUrl !== "string") {
    return null;
  }

  let path = toPathname(publicUrl);
  if (!path) return null;

  if (path.startsWith(`${assetsProxyBase}/`)) {
    path = path.slice(assetsProxyBase.length);
  }

  const bucketPrefix = `/${storageBucket}/`;
  if (path.startsWith(bucketPrefix)) {
    return path.slice(bucketPrefix.length);
  }

  return path.replace(/^\/+/, "") || null;
};

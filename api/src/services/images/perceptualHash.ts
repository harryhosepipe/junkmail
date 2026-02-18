import sharp from "sharp";

export type ImageFingerprint = {
  version: number;
  full: string;
  center: string;
  inner: string;
  sourceWidth: number;
  sourceHeight: number;
};

type CropRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const HASH_SIZE = 8;

const bitsToHex = (bits: number[]) => {
  let out = "";
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    out += nibble.toString(16);
  }
  return out;
};

const cropByRegion = (width: number, height: number, region: CropRegion) => {
  const left = Math.max(0, Math.min(width - 1, Math.round(region.left * width)));
  const top = Math.max(0, Math.min(height - 1, Math.round(region.top * height)));
  const right = Math.max(
    left + 1,
    Math.min(width, Math.round((region.left + region.width) * width)),
  );
  const bottom = Math.max(
    top + 1,
    Math.min(height, Math.round((region.top + region.height) * height)),
  );
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
};

const dHashFromBuffer = async (input: Buffer) => {
  const { data } = await sharp(input)
    .grayscale()
    .resize(HASH_SIZE + 1, HASH_SIZE, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bits: number[] = [];
  for (let y = 0; y < HASH_SIZE; y += 1) {
    for (let x = 0; x < HASH_SIZE; x += 1) {
      const leftPixel = data[y * (HASH_SIZE + 1) + x];
      const rightPixel = data[y * (HASH_SIZE + 1) + x + 1];
      bits.push(leftPixel > rightPixel ? 1 : 0);
    }
  }
  return bitsToHex(bits);
};

const extractRegion = async (input: Buffer, width: number, height: number, region: CropRegion) => {
  const extract = cropByRegion(width, height, region);
  return sharp(input).extract(extract).toBuffer();
};

export const computeImageFingerprint = async (input: Buffer): Promise<ImageFingerprint> => {
  const metadata = await sharp(input).metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;
  if (sourceWidth < 2 || sourceHeight < 2) {
    throw new Error("Invalid image dimensions for fingerprinting");
  }

  const centerBuffer = await extractRegion(input, sourceWidth, sourceHeight, {
    left: 0.1,
    top: 0.1,
    width: 0.8,
    height: 0.8,
  });
  const innerBuffer = await extractRegion(input, sourceWidth, sourceHeight, {
    left: 0,
    top: 0.08,
    width: 1,
    height: 0.84,
  });

  const [full, center, inner] = await Promise.all([
    dHashFromBuffer(input),
    dHashFromBuffer(centerBuffer),
    dHashFromBuffer(innerBuffer),
  ]);

  return {
    version: 1,
    full,
    center,
    inner,
    sourceWidth,
    sourceHeight,
  };
};

export const hammingDistanceHex = (a: string, b: string) => {
  if (a.length !== b.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = parseInt(a[i], 16);
    const y = parseInt(b[i], 16);
    const xor = x ^ y;
    distance += (xor & 1) + ((xor >> 1) & 1) + ((xor >> 2) & 1) + ((xor >> 3) & 1);
  }
  return distance;
};

export const similarityAnchor = (fingerprint: ImageFingerprint, length = 2) =>
  fingerprint.full.slice(0, Math.max(1, Math.min(length, fingerprint.full.length)));

export const isNearDuplicate = (args: {
  incoming: ImageFingerprint;
  existing?: Partial<ImageFingerprint> | null;
}) => {
  const { incoming, existing } = args;
  if (!existing?.full || !existing?.center || !existing?.inner) return false;
  if (!existing.sourceWidth || !existing.sourceHeight) return false;

  const incomingAspect = incoming.sourceWidth / incoming.sourceHeight;
  const existingAspect = existing.sourceWidth / existing.sourceHeight;
  const aspectDelta = Math.abs(incomingAspect - existingAspect) / Math.max(existingAspect, 0.0001);
  if (aspectDelta > 0.2) return false;

  const distances = [
    hammingDistanceHex(incoming.full, existing.full),
    hammingDistanceHex(incoming.center, existing.center),
    hammingDistanceHex(incoming.inner, existing.inner),
  ].filter((value) => Number.isFinite(value));
  if (!distances.length) return false;

  const minDistance = Math.min(...distances);
  if (minDistance <= 12) return true;

  const close = distances.filter((distance) => distance <= 16).sort((a, b) => a - b);
  if (close.length >= 2) {
    const avg = (close[0] + close[1]) / 2;
    if (avg <= 14) return true;
  }
  return false;
};

export type OrbVerifyCandidate = {
  imageId: string;
  url: string;
};

export type OrbVerifyResult = {
  verified: boolean;
  matchedImageId?: string;
  scores?: {
    inliers?: number;
    inlierRatio?: number;
    matches?: number;
  };
  diagnostics?: unknown;
};

export const verifyOrbCandidates = async (args: {
  verifierUrl: string;
  uploadBuffer: Buffer;
  candidates: OrbVerifyCandidate[];
  minInliers: number;
  minInlierRatio: number;
  minMatches: number;
  timeoutMs?: number;
}): Promise<OrbVerifyResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? 3500);

  try {
    const response = await fetch(args.verifierUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        uploadImageBase64: args.uploadBuffer.toString("base64"),
        candidates: args.candidates,
        minInliers: args.minInliers,
        minInlierRatio: args.minInlierRatio,
        minMatches: args.minMatches,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`ORB verifier failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as OrbVerifyResult;
    return {
      verified: Boolean(payload?.verified),
      matchedImageId: payload?.matchedImageId,
      scores: payload?.scores,
      diagnostics: payload?.diagnostics,
    };
  } finally {
    clearTimeout(timeout);
  }
};

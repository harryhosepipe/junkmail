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
  sharedSecret?: string;
  timeoutMs?: number;
  retries?: number;
}): Promise<OrbVerifyResult> => {
  const retries = Math.max(0, Math.floor(args.retries ?? 2));
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? 3500);

    try {
      const response = await fetch(args.verifierUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(args.sharedSecret
            ? {
                authorization: `Bearer ${args.sharedSecret}`,
              }
            : {}),
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
        if (response.status >= 500 && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 150));
          continue;
        }
        throw new Error(`ORB verifier failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as OrbVerifyResult;
      return {
        verified: Boolean(payload?.verified),
        matchedImageId: payload?.matchedImageId,
        scores: payload?.scores,
        diagnostics: payload?.diagnostics,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 150));
        continue;
      }
      break;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("ORB verifier request failed");
};

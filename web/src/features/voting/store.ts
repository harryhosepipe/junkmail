import { createVotingApi, type MatchupResponse } from "./api";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeVariants = (value: unknown) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value as Record<string, Record<string, string>>;
};

const pickImageUrl = (item: { variantUrls?: unknown; originalUrl?: string } | undefined) => {
  const variants = normalizeVariants(item?.variantUrls);
  const variant = variants?.feed || variants?.full || variants?.thumb || {};
  return variant.webp || variant.avif || variant.jpg || variant.png || item?.originalUrl || "";
};

const preloadImage = (url: string) =>
  new Promise<void>((resolve) => {
    if (!url || typeof Image === "undefined") {
      resolve();
      return;
    }

    const image = new Image();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    image.onload = finish;
    image.onerror = finish;
    image.decoding = "async";
    image.src = url;

    if (typeof image.decode === "function") {
      image.decode().then(finish).catch(finish);
    }
  });

const warmMatchupAssets = (data: MatchupResponse) =>
  Promise.allSettled([preloadImage(pickImageUrl(data?.a)), preloadImage(pickImageUrl(data?.b))]);

export const createVotingStore = (apiBaseUrl = "") => {
  const votingApi = createVotingApi(apiBaseUrl);
  let prefetchedMatchup: MatchupResponse | null = null;
  let prefetchPromise: Promise<void> | null = null;
  let prefetchedAssetsReady: Promise<unknown> = Promise.resolve();

  const requestMatchup = async () => {
    try {
      return await votingApi.getNextMatchup();
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "status" in error &&
        Number((error as { status?: number }).status) === 404
      ) {
        throw new Error("Not enough images yet.");
      }
      throw new Error("Matchup unavailable.");
    }
  };

  const prefetchNextMatchup = () => {
    if (prefetchPromise) return;
    prefetchPromise = requestMatchup()
      .then((data) => {
        prefetchedMatchup = data;
        prefetchedAssetsReady = warmMatchupAssets(data);
      })
      .catch(() => {
        prefetchedMatchup = null;
        prefetchedAssetsReady = Promise.resolve();
      })
      .finally(() => {
        prefetchPromise = null;
      });
  };

  const consumePrefetchedMatchup = async () => {
    if (!prefetchedMatchup && prefetchPromise) {
      await prefetchPromise;
    }
    if (!prefetchedMatchup) return null;
    const next = prefetchedMatchup;
    prefetchedMatchup = null;
    await Promise.race([prefetchedAssetsReady, wait(350)]);
    return next;
  };

  const sendVote = (args: {
    imageAId: string;
    imageBId: string;
    winnerId: string;
    matchupToken?: string;
  }) => votingApi.submitVote(args);

  return {
    requestMatchup,
    prefetchNextMatchup,
    consumePrefetchedMatchup,
    sendVote,
  };
};

const num = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${name}: expected number, got ${JSON.stringify(raw)}`);
  }
  return value;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",

  // Rating params (names aligned with packages/config schema + root .env.example)
  BRADLEY_TERRY_K: num("BRADLEY_TERRY_K", 0.15),
  RATING_INITIAL_SCORE: num("RATING_INITIAL_SCORE", 0),
  RATING_INITIAL_UNCERTAINTY: num("RATING_INITIAL_UNCERTAINTY", 1),
  RATING_MIN_UNCERTAINTY: num("RATING_MIN_UNCERTAINTY", 0.15),
} as const;

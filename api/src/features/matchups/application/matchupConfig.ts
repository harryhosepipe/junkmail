import { z } from "zod";

const NumFromString = z.coerce.number();
const matchupConfigSchema = z.object({
  MATCHUP_NEW_EXPOSURE: NumFromString.optional(),
  MATCHUP_CLOSE_SAMPLE: NumFromString.optional(),
  MATCHUP_CLOSE_CANDIDATE_PAIRS: NumFromString.optional(),
  MATCHUP_REPEAT_TTL_SECONDS: NumFromString.optional(),
  MATCHUP_POOL_TTL_SECONDS: NumFromString.optional(),
  MATCHUP_PAIR_COOLDOWN_MS: NumFromString.optional(),
  MATCHUP_WEIGHT_NEW: NumFromString.optional(),
  MATCHUP_WEIGHT_CLOSE: NumFromString.optional(),
  MATCHUP_WEIGHT_RANDOM: NumFromString.optional(),
});

const parseMatchupConfig = () => {
  const parsed = matchupConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid matchup environment override:\n${issues}`);
  }
  return parsed.data;
};

const config = parseMatchupConfig();

export const matchupConfig = {
  newExposureThreshold: config.MATCHUP_NEW_EXPOSURE ?? 5,
  closeSampleSize: config.MATCHUP_CLOSE_SAMPLE ?? 24,
  closeCandidatePairs: config.MATCHUP_CLOSE_CANDIDATE_PAIRS ?? 6,
  repeatTtlSeconds: config.MATCHUP_REPEAT_TTL_SECONDS ?? 120,
  poolTtlSeconds: config.MATCHUP_POOL_TTL_SECONDS ?? 10,
  pairCooldownMs: config.MATCHUP_PAIR_COOLDOWN_MS ?? 900,
  weightNew: config.MATCHUP_WEIGHT_NEW ?? 0.45,
  weightClose: config.MATCHUP_WEIGHT_CLOSE ?? 0.4,
  weightRandom: config.MATCHUP_WEIGHT_RANDOM ?? 0.15,
};

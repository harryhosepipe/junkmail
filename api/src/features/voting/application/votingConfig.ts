import { z } from "zod";

const NumFromString = z.coerce.number();
const votingConfigSchema = z.object({
  VOTE_HASH_SALT: z.string().optional(),
  IP_HASH_SALT: z.string().optional(),
  VOTE_RATE_LIMIT_BURST: NumFromString.optional(),
  VOTE_RATE_LIMIT_BURST_WINDOW: NumFromString.optional(),
  VOTE_RATE_LIMIT_SUSTAINED: NumFromString.optional(),
  VOTE_RATE_LIMIT_SUSTAINED_WINDOW: NumFromString.optional(),
});

const parseVotingConfig = () => {
  const parsed = votingConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid voting environment override:\n${issues}`);
  }
  return parsed.data;
};

const config = parseVotingConfig();

export const votingConfig = {
  voteHashSalt: config.VOTE_HASH_SALT ?? "junkmail-dev-vote",
  ipHashSalt: config.IP_HASH_SALT ?? config.VOTE_HASH_SALT ?? "junkmail-dev-vote",
  rateLimitBurst: config.VOTE_RATE_LIMIT_BURST ?? 20,
  rateLimitBurstWindow: config.VOTE_RATE_LIMIT_BURST_WINDOW ?? 60,
  rateLimitSustained: config.VOTE_RATE_LIMIT_SUSTAINED ?? 240,
  rateLimitSustainedWindow: config.VOTE_RATE_LIMIT_SUSTAINED_WINDOW ?? 3600,
};

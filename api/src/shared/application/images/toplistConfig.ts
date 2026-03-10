import { z } from "zod";

const NumFromString = z.coerce.number();
const toplistConfigSchema = z.object({
  TOPLIST_MIN_COMPARISONS: NumFromString.optional(),
  TOPLIST_CACHE_SECONDS: NumFromString.optional(),
});

const parseToplistConfig = () => {
  const parsed = toplistConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid toplist environment override:\n${issues}`);
  }
  return parsed.data;
};

const config = parseToplistConfig();

export const toplistConfig = {
  minComparisons: config.TOPLIST_MIN_COMPARISONS ?? 10,
  cacheSeconds: config.TOPLIST_CACHE_SECONDS ?? 90,
};

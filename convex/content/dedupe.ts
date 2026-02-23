import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length ? trimmed : undefined;
};

const pickNumericField = (container: unknown, key: string) => {
  if (!container || typeof container !== "object") return NaN;
  const value = (container as Record<string, unknown>)[key];
  return Number(value);
};

export const createDedupeEvent = mutation({
  args: {
    uploadImageId: v.string(),
    decision: v.string(),
    reason: v.string(),
    matchedImageId: v.optional(v.string()),
    scores: v.optional(v.any()),
    metrics: v.optional(v.any()),
    workerVersion: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("dedupeEvents", {
      uploadImageId: args.uploadImageId,
      decision: args.decision,
      reason: args.reason,
      matchedImageId: normalizeText(args.matchedImageId),
      scores: args.scores,
      metrics: args.metrics,
      workerVersion: normalizeText(args.workerVersion),
      createdAt: args.createdAt ?? Date.now(),
    });
    return { ok: true };
  },
});

export const listRecentDedupeEvents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 100), 500));
    return ctx.db.query("dedupeEvents").withIndex("by_created_at").order("desc").take(limit);
  },
});

export const getDedupeStats = query({
  args: {
    windowHours: v.optional(v.number()),
    sampleLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const windowHours = Math.max(1, Math.min(Math.floor(args.windowHours ?? 24), 24 * 30));
    const sampleLimit = Math.max(100, Math.min(Math.floor(args.sampleLimit ?? 2000), 10000));
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("dedupeEvents")
      .withIndex("by_created_at")
      .order("desc")
      .take(sampleLimit);
    const inWindow = rows.filter((row) => row.createdAt >= cutoff);

    const byDecision: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    let orbErrorCount = 0;
    const latencies: number[] = [];
    const phashDistances: number[] = [];
    const orbInliers: number[] = [];
    const orbRatios: number[] = [];

    for (const row of inWindow) {
      byDecision[row.decision] = (byDecision[row.decision] || 0) + 1;
      byReason[row.reason] = (byReason[row.reason] || 0) + 1;
      if (row.reason === "orb_error_fallback") orbErrorCount += 1;

      const duration = pickNumericField(row.metrics, "durationMs");
      if (Number.isFinite(duration) && duration >= 0) latencies.push(duration);

      const phashDistance = pickNumericField(row.scores, "phashDistance");
      if (Number.isFinite(phashDistance) && phashDistance >= 0) phashDistances.push(phashDistance);

      const inliers = pickNumericField(row.scores, "inliers");
      if (Number.isFinite(inliers) && inliers >= 0) orbInliers.push(inliers);

      const inlierRatio = pickNumericField(row.scores, "inlierRatio");
      if (Number.isFinite(inlierRatio) && inlierRatio >= 0) orbRatios.push(inlierRatio);
    }

    latencies.sort((a, b) => a - b);
    const percentile = (values: number[], p: number) => {
      if (!values.length) return null;
      const idx = Math.min(values.length - 1, Math.floor((values.length - 1) * p));
      return values[idx];
    };
    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

    return {
      windowHours,
      sampleLimit,
      sampledRows: rows.length,
      inWindowRows: inWindow.length,
      byDecision,
      byReason,
      orbErrorCount,
      latencyMs: {
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        avg: avg(latencies),
      },
      phashDistance: {
        avg: avg(phashDistances),
        min: phashDistances.length ? phashDistances[0] : null,
        max: phashDistances.length ? phashDistances[phashDistances.length - 1] : null,
      },
      orb: {
        avgInliers: avg(orbInliers),
        avgInlierRatio: avg(orbRatios),
      },
    };
  },
});

import { Queue } from "bullmq";
import { queryConvexRatingsByImageIds, queryConvexTopRatings } from "../convex/client.js";
import { redis } from "../queue/connection.js";
import { env, getEnv } from "../env.js";

type MatchupPayload = {
  a: { id: string };
  b: { id: string };
  seed: string;
};

type VoteStats = {
  successes: number;
  failures: number;
  latencies: number[];
  failureStatusCounts: Record<string, number>;
  failureSamples: string[];
};

getEnv();

const API_BASE_URL = env.API_ORIGIN ?? env.API_BASE_URL ?? "http://web.localhost";
const ORIGIN = env.WEB_ORIGIN ?? env.WEB_BASE_URL ?? env.APP_ORIGIN ?? env.CORS_ORIGIN ?? "http://web.localhost";
const CONCURRENT_USERS = env.REALTIME_TEST_USERS ?? 100;
const VOTES_PER_USER = env.REALTIME_TEST_VOTES_PER_USER ?? 8;
const PROBE_VOTES = env.REALTIME_TEST_PROBE_VOTES ?? 12;
const PROBE_TIMEOUT_MS = env.REALTIME_TEST_PROBE_TIMEOUT_MS ?? 5000;
const PROBE_POLL_MS = env.REALTIME_TEST_PROBE_POLL_MS ?? 120;
const DISCOVERY_ROUNDS = env.REALTIME_TEST_DISCOVERY_ROUNDS ?? 250;
const LATENCY_P95_TARGET_MS = env.REALTIME_TEST_P95_TARGET_MS ?? 300;
const UPDATE_P95_TARGET_MS = env.REALTIME_TEST_UPDATE_P95_TARGET_MS ?? 1500;
const DRAIN_TIMEOUT_MS = env.REALTIME_TEST_DRAIN_TIMEOUT_MS ?? 30000;
const DRAIN_POLL_MS = env.REALTIME_TEST_DRAIN_POLL_MS ?? 200;
const voteQueue = new Queue("vote-writes", { connection: redis });

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getMatchup = async (voterId: string, ip: string) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/matchups/next`, {
    headers: {
      cookie: `jm_voter=${voterId}`,
      "x-forwarded-for": ip,
    },
  });
  if (!response.ok) {
    throw new Error(`matchup failed (${response.status})`);
  }
  const payload = (await response.json()) as MatchupPayload;
  if (!payload?.a?.id || !payload?.b?.id || !payload.seed) {
    throw new Error("invalid matchup payload");
  }
  return payload;
};

const postVote = async (payload: MatchupPayload, voterId: string, ip: string, winnerId: string) => {
  const startedAt = Date.now();
  const response = await fetch(`${API_BASE_URL}/api/v1/votes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      cookie: `jm_voter=${voterId}`,
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({
      image_a_id: payload.a.id,
      image_b_id: payload.b.id,
      winner_id: winnerId,
      seed: payload.seed,
    }),
  });
  const latencyMs = Date.now() - startedAt;
  return { response, latencyMs };
};

const runDiscovery = async () => {
  const ids = new Set<string>();
  for (let i = 0; i < DISCOVERY_ROUNDS; i += 1) {
    const voterId = `discover-${i}`;
    const ip = `10.200.0.${(i % 250) + 1}`;
    const matchup = await getMatchup(voterId, ip);
    ids.add(matchup.a.id);
    ids.add(matchup.b.id);
  }
  return [...ids];
};

const runProbeLatency = async (
  expectedAppearances: Map<string, number>,
  touchedIds: Set<string>,
) => {
  const propagationLatencies: number[] = [];
  const failures: string[] = [];

  for (let i = 0; i < PROBE_VOTES; i += 1) {
    const voterId = `probe-${i}`;
    const ip = `10.100.0.${(i % 250) + 1}`;
    const matchup = await getMatchup(voterId, ip);
    const ids = [matchup.a.id, matchup.b.id];
    touchedIds.add(matchup.a.id);
    touchedIds.add(matchup.b.id);

    const beforeRows = await queryConvexRatingsByImageIds(ids);
    const beforeMap = new Map(beforeRows.map((row) => [row.imageId, row.comparisonsCount ?? 0]));
    const winnerId = Math.random() < 0.5 ? matchup.a.id : matchup.b.id;

    const { response, latencyMs } = await postVote(matchup, voterId, ip, winnerId);
    if (!response.ok) {
      failures.push(`probe vote ${i + 1} failed (${response.status})`);
      continue;
    }

    expectedAppearances.set(matchup.a.id, (expectedAppearances.get(matchup.a.id) || 0) + 1);
    expectedAppearances.set(matchup.b.id, (expectedAppearances.get(matchup.b.id) || 0) + 1);

    const pollStartedAt = Date.now();
    let converged = false;
    while (Date.now() - pollStartedAt <= PROBE_TIMEOUT_MS) {
      const afterRows = await queryConvexRatingsByImageIds(ids);
      const afterMap = new Map(afterRows.map((row) => [row.imageId, row.comparisonsCount ?? 0]));
      const ok = ids.every((id) => (afterMap.get(id) || 0) >= (beforeMap.get(id) || 0) + 1);
      if (ok) {
        propagationLatencies.push(Date.now() - pollStartedAt);
        converged = true;
        break;
      }
      await sleep(PROBE_POLL_MS);
    }

    if (!converged) {
      failures.push(`probe propagation timeout (${latencyMs}ms vote latency)`);
    }
  }

  return {
    failures,
    latencies: propagationLatencies,
  };
};

const runConcurrentLoad = async (
  expectedAppearances: Map<string, number>,
  touchedIds: Set<string>,
) => {
  const stats: VoteStats = {
    successes: 0,
    failures: 0,
    latencies: [],
    failureStatusCounts: {},
    failureSamples: [],
  };

  await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, async (_, index) => {
      const voterId = `load-${index}`;
      const ip = `10.0.${Math.floor(index / 250)}.${(index % 250) + 1}`;
      for (let voteIndex = 0; voteIndex < VOTES_PER_USER; voteIndex += 1) {
        try {
          const matchup = await getMatchup(voterId, ip);
          touchedIds.add(matchup.a.id);
          touchedIds.add(matchup.b.id);
          const winnerId = Math.random() < 0.5 ? matchup.a.id : matchup.b.id;
          const { response, latencyMs } = await postVote(matchup, voterId, ip, winnerId);
          if (!response.ok) {
            stats.failures += 1;
            const key = `${response.status}`;
            stats.failureStatusCounts[key] = (stats.failureStatusCounts[key] || 0) + 1;
            if (stats.failureSamples.length < 10) {
              const body = await response.text().catch(() => "");
              stats.failureSamples.push(`${response.status}: ${body.slice(0, 240)}`);
            }
            continue;
          }

          stats.successes += 1;
          stats.latencies.push(latencyMs);
          expectedAppearances.set(matchup.a.id, (expectedAppearances.get(matchup.a.id) || 0) + 1);
          expectedAppearances.set(matchup.b.id, (expectedAppearances.get(matchup.b.id) || 0) + 1);
        } catch {
          stats.failures += 1;
          stats.failureStatusCounts.fetch_error = (stats.failureStatusCounts.fetch_error || 0) + 1;
        }
      }
    }),
  );

  return stats;
};

const ensureSortedToplist = async () => {
  const rows = await queryConvexTopRatings({ limit: 200, minComparisons: 0 });
  const duplicateIds = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.imageId)) {
      duplicateIds.add(row.imageId);
    }
    seen.add(row.imageId);
  }
  const sorted = rows.every((row, index) => index === 0 || rows[index - 1].score >= row.score);
  return {
    sorted,
    duplicates: [...duplicateIds],
    count: rows.length,
  };
};

const waitForVoteQueueDrain = async () => {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= DRAIN_TIMEOUT_MS) {
    const counts = await voteQueue.getJobCounts(
      "waiting",
      "active",
      "delayed",
      "prioritized",
      "waiting-children",
    );
    const pending =
      (counts.waiting || 0) +
      (counts.active || 0) +
      (counts.delayed || 0) +
      (counts.prioritized || 0) +
      ((counts as Record<string, number>)["waiting-children"] || 0);
    if (pending === 0) {
      return {
        drained: true,
        elapsedMs: Date.now() - startedAt,
      };
    }
    await sleep(DRAIN_POLL_MS);
  }

  return {
    drained: false,
    elapsedMs: Date.now() - startedAt,
  };
};

const run = async () => {
  const expectedAppearances = new Map<string, number>();
  const touchedIds = new Set<string>();

  const discoveredIds = await runDiscovery();
  const baselineRows = await queryConvexRatingsByImageIds(discoveredIds);
  const baselineByImage = new Map(
    baselineRows.map((row) => [row.imageId, row.comparisonsCount ?? 0]),
  );

  const probe = await runProbeLatency(expectedAppearances, touchedIds);
  const load = await runConcurrentLoad(expectedAppearances, touchedIds);
  const queueDrain = await waitForVoteQueueDrain();
  const postRows = await queryConvexRatingsByImageIds([...touchedIds]);
  const postByImage = new Map(postRows.map((row) => [row.imageId, row.comparisonsCount ?? 0]));
  const toplist = await ensureSortedToplist();

  const unknownBaselineIds: string[] = [];
  let consistencyMismatches = 0;

  for (const [imageId, expected] of expectedAppearances) {
    if (!baselineByImage.has(imageId)) {
      unknownBaselineIds.push(imageId);
      continue;
    }
    const baseline = baselineByImage.get(imageId) || 0;
    const post = postByImage.get(imageId) || 0;
    const delta = post - baseline;
    if (delta !== expected) {
      consistencyMismatches += 1;
    }
  }

  const voteP95 = percentile(load.latencies, 95);
  const voteP99 = percentile(load.latencies, 99);
  const updateP95 = percentile(probe.latencies, 95);
  const updateP99 = percentile(probe.latencies, 99);

  const assertions = [
    {
      name: "vote latency p95 under target",
      ok: voteP95 <= LATENCY_P95_TARGET_MS,
      actual: voteP95,
      target: LATENCY_P95_TARGET_MS,
    },
    {
      name: "propagation latency p95 under target",
      ok: updateP95 <= UPDATE_P95_TARGET_MS,
      actual: updateP95,
      target: UPDATE_P95_TARGET_MS,
    },
    {
      name: "probe propagation had no failures",
      ok: probe.failures.length === 0,
      actual: probe.failures.length,
      target: 0,
    },
    {
      name: "load vote failures stayed at zero",
      ok: load.failures === 0,
      actual: load.failures,
      target: 0,
    },
    {
      name: "vote queue drained before verification",
      ok: queueDrain.drained,
      actual: queueDrain,
      target: { drained: true, timeoutMs: DRAIN_TIMEOUT_MS },
    },
    {
      name: "toplist rows are score-sorted and unique",
      ok: toplist.sorted && toplist.duplicates.length === 0,
      actual: {
        sorted: toplist.sorted,
        duplicates: toplist.duplicates.length,
      },
      target: {
        sorted: true,
        duplicates: 0,
      },
    },
    {
      name: "comparisons count matched expected appearance deltas",
      ok: consistencyMismatches === 0 && unknownBaselineIds.length === 0,
      actual: {
        mismatches: consistencyMismatches,
        unknownBaselines: unknownBaselineIds.length,
      },
      target: {
        mismatches: 0,
        unknownBaselines: 0,
      },
    },
  ];

  const result = {
    ok: assertions.every((item) => item.ok),
    config: {
      apiBaseUrl: API_BASE_URL,
      users: CONCURRENT_USERS,
      votesPerUser: VOTES_PER_USER,
      probeVotes: PROBE_VOTES,
      discoveryRounds: DISCOVERY_ROUNDS,
      targets: {
        voteP95Ms: LATENCY_P95_TARGET_MS,
        updateP95Ms: UPDATE_P95_TARGET_MS,
      },
    },
    summary: {
      successfulVotes: load.successes,
      failedVotes: load.failures,
      failedVoteStatusCounts: load.failureStatusCounts,
      touchedImages: touchedIds.size,
      queueDrain,
      voteLatencyMs: {
        p50: percentile(load.latencies, 50),
        p95: voteP95,
        p99: voteP99,
        max: Math.max(0, ...load.latencies),
      },
      propagationLatencyMs: {
        p50: percentile(probe.latencies, 50),
        p95: updateP95,
        p99: updateP99,
        max: Math.max(0, ...probe.latencies),
      },
      toplistRows: toplist.count,
    },
    assertions,
    probeFailures: probe.failures,
    failureSamples: load.failureSamples,
    unknownBaselineIds,
  };

  console.log(JSON.stringify(result, null, 2));
  await voteQueue.close();
  redis.disconnect();
  if (!result.ok) {
    process.exit(1);
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Realtime voting validation failed";
  void voteQueue.close().then(() => redis.disconnect());
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});

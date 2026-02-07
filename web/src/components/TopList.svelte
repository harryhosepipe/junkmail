<script>
  import { onDestroy, onMount } from "svelte";
  import { convex } from "../lib/convex";

  export let apiBaseUrl = "http://localhost:8787";

  let items = [];
  let state = "loading";
  let connection = "connecting";
  const minComparisons = 0;

  let unsubscribeToplist = null;
  let unsubscribeConnection = null;
  const thumbById = new Map();

  const placeholders = Array.from({ length: 8 });

  const formatScore = (value) => {
    const score = Number(value);
    if (Number.isNaN(score)) return "0.00";
    return score.toFixed(2);
  };

  const mergeToplist = (rows) =>
    rows
      .map((row) => ({
        id: row?.imageId || row?.id,
        score: Number(row?.score) || 0,
        votes: Number(row?.comparisonsCount) || Number(row?.votes) || 0,
        thumb_url: thumbById.get(row?.imageId || row?.id) || "",
      }))
      .filter((row) => row.id);

  const hydrateThumbs = async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/images/top?limit=100&min=${minComparisons}`,
      );
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        if (row?.id) {
          thumbById.set(row.id, row?.thumb_url || "");
        }
      }
    } catch {
      // keep rendering even if thumb hydration fails
    }
  };

  const subscribeToplist = () => {
    if (unsubscribeToplist) {
      unsubscribeToplist();
    }

    unsubscribeToplist = convex.onUpdate(
      "voting:getTopRatings",
      { limit: 20, minComparisons },
      (rows) => {
        items = mergeToplist(Array.isArray(rows) ? rows : []);
        state = "ready";
      },
      () => {
        state = "error";
      },
    );
  };

  onMount(async () => {
    state = "loading";

    unsubscribeConnection = convex.subscribeToConnectionState((next) => {
      connection = next?.hasInflightRequests ? "syncing" : "live";
    });

    await hydrateThumbs();
    subscribeToplist();

    const fallback = setTimeout(async () => {
      if (state !== "loading") return;
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/images/top?limit=20&min=${minComparisons}`,
        );
        if (!response.ok) {
          state = "error";
          return;
        }
        const data = await response.json();
        items = mergeToplist(Array.isArray(data) ? data : []);
        state = "ready";
      } catch {
        state = "error";
      }
    }, 2000);

    return () => {
      clearTimeout(fallback);
    };
  });

  onDestroy(() => {
    if (unsubscribeToplist) {
      unsubscribeToplist();
      unsubscribeToplist = null;
    }
    if (unsubscribeConnection) {
      unsubscribeConnection();
      unsubscribeConnection = null;
    }
  });

  $: statusText =
    connection === "syncing"
      ? "Syncing votes..."
      : connection === "live"
        ? "Live updates on"
        : "Connecting...";
</script>

<div class="toplist-header">
  <div class="toplist-title">Ranked by pairwise wins</div>
  <div class="toplist-status">{statusText}</div>
</div>

{#if state === "loading"}
  <div class="toplist">
    {#each placeholders as _}
      <div class="top-row">
        <div class="top-rank skeleton-line"></div>
        <div class="top-thumb skeleton"></div>
        <div class="top-meta">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if state === "error"}
  <p class="subtle" style="margin-top: 12px;">Could not load the toplist.</p>
{:else if items.length === 0}
  <p class="subtle" style="margin-top: 12px;">No ranked images yet.</p>
{:else}
  <div class="toplist">
    {#each items as item, index}
      <a class="top-row" href={`/image/${item.id}`}>
        <div class="top-rank">#{index + 1}</div>
        <div class="top-thumb">
          {#if item.thumb_url}
            <img
              src={item.thumb_url}
              alt={`Top ranked junkmail #${index + 1}`}
              loading="lazy"
              decoding="async"
            />
          {:else}
            <div class="top-placeholder">Processing</div>
          {/if}
        </div>
        <div class="top-meta">
          <div class="top-score">Score {formatScore(item.score)}</div>
          <div class="top-votes">Appearances: {item.votes ?? 0}</div>
        </div>
      </a>
    {/each}
  </div>
{/if}

<style>
  .toplist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .toplist-title {
    font-weight: 700;
    color: var(--bg-ink);
  }

  .toplist-status {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .toplist {
    display: grid;
    gap: 12px;
  }

  .top-row {
    display: grid;
    align-items: center;
    grid-template-columns: 60px 120px 1fr;
    gap: 16px;
    padding: 12px 16px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: #fffcf7;
    color: inherit;
    text-decoration: none;
    box-shadow: var(--shadow);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .top-row:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 30px -24px rgba(0, 0, 0, 0.35);
  }

  .top-rank {
    font-weight: 700;
    font-size: 18px;
    color: var(--bg-ink);
  }

  .top-thumb {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #fffdf9;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .top-thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .top-placeholder {
    color: var(--ink-muted);
    font-size: 13px;
  }

  .top-meta {
    display: grid;
    gap: 6px;
  }

  .top-score {
    font-weight: 700;
  }

  .top-votes {
    font-size: 13px;
    color: var(--ink-muted);
  }

  @media (max-width: 720px) {
    .top-row {
      grid-template-columns: 48px 1fr;
    }

    .top-meta {
      grid-column: 1 / -1;
    }
  }

  .skeleton {
    background: linear-gradient(120deg, #f1e8db 0%, #fff4e8 50%, #f1e8db 100%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease infinite;
  }

  .skeleton-line {
    height: 14px;
    border-radius: 999px;
    background: linear-gradient(120deg, #f1e8db 0%, #fff4e8 50%, #f1e8db 100%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease infinite;
  }

  .skeleton-line.short {
    width: 70%;
  }

  @keyframes shimmer {
    0% {
      background-position: 0% 0%;
    }
    100% {
      background-position: 200% 0%;
    }
  }
</style>

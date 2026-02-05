<script>
  import { onDestroy, onMount } from "svelte";

  export let apiBaseUrl = "http://localhost:8787";
  export let refreshIntervalSeconds = 90;

  let items = [];
  let state = "loading";
  const minComparisons = 0;
  let countdown = refreshIntervalSeconds;
  let countdownLabel = "seconds";
  let nextRefreshAt = null;
  let countdownTimer = null;

  const placeholders = Array.from({ length: 8 });

  const formatScore = (value) => {
    const score = Number(value);
    if (Number.isNaN(score)) return "0.00";
    return score.toFixed(2);
  };

  const setNextRefresh = () => {
    nextRefreshAt = Date.now() + refreshIntervalSeconds * 1000;
  };

  const updateCountdown = () => {
    if (!nextRefreshAt) return;
    const remaining = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
    countdown = remaining;
  };

  const loadToplist = async ({ initial = false } = {}) => {
    if (initial) {
      state = "loading";
    }
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/images/top?limit=20&min=${minComparisons}`
      );
      if (!response.ok) {
        state = "error";
        return;
      }
      const data = await response.json();
      items = Array.isArray(data) ? data : [];
      state = "ready";
      setNextRefresh();
      updateCountdown();
    } catch (err) {
      state = "error";
    }
  };

  const startCountdown = () => {
    if (countdownTimer) return;
    countdownTimer = setInterval(() => {
      if (!nextRefreshAt) return;
      updateCountdown();
      if (countdown <= 0) {
        loadToplist();
      }
    }, 1000);
  };

  onMount(async () => {
    setNextRefresh();
    updateCountdown();
    startCountdown();
    await loadToplist({ initial: true });
  });

  onDestroy(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
    }
  });

  $: countdownLabel = countdown === 1 ? "second" : "seconds";
</script>

<div class="toplist-header">
  <div class="toplist-title">Ranked by pairwise wins</div>
  <div class="toplist-countdown">Final votes tallied in {countdown} {countdownLabel}</div>
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

  .toplist-countdown {
    font-size: 16px;
    font-weight: 700;
    color: var(--bg-ink);
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
    transition: transform 0.2s ease, box-shadow 0.2s ease;
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

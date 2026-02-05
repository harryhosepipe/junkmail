<script>
  import { onDestroy, onMount } from "svelte";

  export let apiBaseUrl = "http://localhost:8787";

  let state = "loading";
  let matchup = null;
  let busy = false;
  let loadingNext = false;
  let statusMessage = "";
  let errorMessage = "";
  let lastChoice = null;
  let prefetchedMatchup = null;
  let prefetchPromise = null;

  const normalizeVariants = (value) => {
    if (!value) return {};
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return value;
  };

  const pickImageUrl = (item) => {
    const variants = normalizeVariants(item?.variantUrls);
    const variant = variants?.feed || variants?.full || variants?.thumb || {};
    return variant.webp || variant.avif || variant.jpg || variant.png || item?.originalUrl || "";
  };

  const requestMatchup = async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/matchups/next`, {
      credentials: "include",
    });
    if (!response.ok) {
      const message = response.status === 404 ? "Not enough images yet." : "Matchup unavailable.";
      throw new Error(message);
    }
    return response.json();
  };

  const prefetchNextMatchup = () => {
    if (prefetchPromise) return;
    prefetchPromise = requestMatchup()
      .then((data) => {
        prefetchedMatchup = data;
      })
      .catch(() => {
        prefetchedMatchup = null;
      })
      .finally(() => {
        prefetchPromise = null;
      });
  };

  const loadMatchup = async ({ keepCurrent = false } = {}) => {
    if (keepCurrent) {
      loadingNext = true;
    } else {
      state = "loading";
    }
    errorMessage = "";
    try {
      matchup = await requestMatchup();
      state = "ready";
      prefetchNextMatchup();
      return true;
    } catch (err) {
      errorMessage = err?.message || "Matchup unavailable.";
      state = "error";
      return false;
    } finally {
      loadingNext = false;
    }
  };

  const sendVote = async ({ imageAId, imageBId, winnerId, seed }) => {
    const response = await fetch(`${apiBaseUrl}/api/v1/votes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        image_a_id: imageAId,
        image_b_id: imageBId,
        winner_id: winnerId,
        seed,
      }),
    });

    if (!response.ok) {
      throw new Error("Vote failed. Please try again.");
    }
  };

  const submitVote = async (winnerId) => {
    if (busy || state !== "ready" || !matchup) return;
    const imageAId = matchup?.a?.id;
    const imageBId = matchup?.b?.id;
    if (!imageAId || !imageBId || !winnerId) return;

    busy = true;
    lastChoice = winnerId;
    statusMessage = "Locked. Loading next...";
    errorMessage = "";

    void sendVote({
      imageAId,
      imageBId,
      winnerId,
      seed: matchup?.seed,
    }).catch((err) => {
      errorMessage = err?.message || "Vote failed. Please try again.";
    });

    const nextMatchup = prefetchedMatchup;
    prefetchedMatchup = null;

    if (nextMatchup) {
      matchup = nextMatchup;
      state = "ready";
      busy = false;
      loadingNext = false;
      statusMessage = "";
      lastChoice = null;
      prefetchNextMatchup();
      return;
    }

    loadingNext = true;
    try {
      matchup = await requestMatchup();
      state = "ready";
      prefetchNextMatchup();
    } catch (err) {
      errorMessage = err?.message || "Matchup unavailable.";
      state = "error";
    } finally {
      busy = false;
      loadingNext = false;
      statusMessage = "";
      lastChoice = null;
    }
  };

  const handleKeydown = (event) => {
    if (busy || state !== "ready" || !matchup || event.repeat) return;
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      submitVote(matchup?.a?.id);
      return;
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "l") {
      event.preventDefault();
      submitVote(matchup?.b?.id);
    }
  };

  onMount(async () => {
    await loadMatchup();
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeydown);
    }
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeydown);
    }
  });
</script>

{#if state === "loading"}
  <div class="vote-grid">
    <div class="vote-card skeleton"></div>
    <div class="vote-card skeleton"></div>
  </div>
{:else if state === "error"}
  <div class="vote-error">
    <div class="vote-grid">
      <div class="vote-card">{errorMessage || "Matchup unavailable."}</div>
      <div class="vote-card">Try again.</div>
    </div>
    <button class="vote-retry" type="button" on:click={() => loadMatchup()}>
      Retry
    </button>
  </div>
{:else}
  <div class="vote-header">
    <div class="vote-kicker">No ties. Pick one.</div>
    <div class="vote-shortcuts">A / L or Left / Right</div>
    {#if statusMessage}
      <div class="vote-status" role="status" aria-live="polite">{statusMessage}</div>
    {/if}
    {#if errorMessage}
      <div class="vote-alert" role="status" aria-live="polite">{errorMessage}</div>
    {/if}
  </div>
  <div class="vote-grid" data-state={busy ? "busy" : "ready"}>
    {#each [matchup?.a, matchup?.b] as item, index}
      <button
        class="vote-card live"
        class:selected={lastChoice === item?.id}
        class:pending={busy}
        class:refreshing={loadingNext}
        type="button"
        disabled={!item || busy}
        aria-label={`Vote ${index === 0 ? "A" : "B"}`}
        on:click={() => submitVote(item?.id)}
      >
        <div class="vote-key">{index === 0 ? "A" : "B"}</div>
        <div class="vote-image">
          {#if pickImageUrl(item)}
            <img src={pickImageUrl(item)} alt={item?.title || "Junkmail matchup"} />
          {:else}
            <div class="vote-placeholder">Processing</div>
          {/if}
        </div>
        <div class="vote-meta">
          <div class="vote-title">{item?.title || "Untitled"}</div>
          <div class="vote-subtle">
            {busy
              ? lastChoice === item?.id
                ? "Locked in"
                : "Waiting..."
              : `Vote ${index === 0 ? "A" : "B"}`}
          </div>
        </div>
      </button>
    {/each}
  </div>
{/if}

<style>
  .vote-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .vote-kicker {
    font-weight: 600;
    color: var(--ink-muted);
  }

  .vote-shortcuts {
    font-size: 12px;
    color: var(--ink-muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .vote-status {
    font-size: 12px;
    color: var(--accent-strong);
  }

  .vote-alert {
    font-size: 12px;
    color: var(--accent-strong);
  }

  .vote-error {
    display: grid;
    gap: 12px;
  }

  .vote-retry {
    justify-self: start;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #fffdf9;
    font-weight: 600;
    cursor: pointer;
  }

  .vote-card.live {
    padding: 16px;
    gap: 12px;
    align-content: start;
    place-items: start;
    text-align: left;
    cursor: pointer;
    border: 1px solid var(--border);
    background: #fffcf7;
    color: inherit;
    font-family: inherit;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease,
      border-color 0.15s ease;
  }

  .vote-card.live:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 30px -24px rgba(0, 0, 0, 0.35);
    border-color: rgba(212, 90, 60, 0.4);
  }

  .vote-card.live:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .vote-card.live:disabled {
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    opacity: 0.7;
  }

  .vote-card.live.pending {
    opacity: 0.72;
  }

  .vote-card.live.selected {
    border-color: var(--accent);
    box-shadow: 0 18px 32px -26px rgba(212, 90, 60, 0.45);
    opacity: 1;
  }

  .vote-key {
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--ink-muted);
  }

  .vote-image {
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

  .vote-image img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .vote-meta {
    display: grid;
    gap: 4px;
  }

  .vote-title {
    font-weight: 700;
    color: var(--bg-ink);
  }

  .vote-subtle {
    font-size: 12px;
    color: var(--ink-muted);
  }

  .vote-placeholder {
    color: var(--ink-muted);
    font-size: 14px;
  }

  .skeleton {
    background: linear-gradient(120deg, #f1e8db 0%, #fff4e8 50%, #f1e8db 100%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease infinite;
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

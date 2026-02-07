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
  let celebrateChoiceId = null;
  let prefetchedMatchup = null;
  let prefetchPromise = null;
  let prefetchedAssetsReady = Promise.resolve();
  let celebrateResetTimer = null;
  const celebrationMinVisibleMs = 220;

  const confettiPieces = [
    { x: -52, y: -56, hue: 12, delay: 0 },
    { x: -36, y: -72, hue: 28, delay: 40 },
    { x: -12, y: -80, hue: 54, delay: 65 },
    { x: 14, y: -82, hue: 188, delay: 25 },
    { x: 38, y: -74, hue: 154, delay: 70 },
    { x: 54, y: -58, hue: 332, delay: 10 },
  ];

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const preloadImage = (url) =>
    new Promise((resolve) => {
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

  const warmMatchupAssets = (data) =>
    Promise.allSettled([preloadImage(pickImageUrl(data?.a)), preloadImage(pickImageUrl(data?.b))]);

  const consumePrefetchedMatchup = async () => {
    if (!prefetchedMatchup && prefetchPromise) {
      await prefetchPromise;
    }

    if (!prefetchedMatchup) {
      return null;
    }

    const next = prefetchedMatchup;
    prefetchedMatchup = null;
    await Promise.race([prefetchedAssetsReady, wait(350)]);
    return next;
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

  const triggerCelebrate = (winnerId) => {
    celebrateChoiceId = winnerId;
    if (celebrateResetTimer) {
      clearTimeout(celebrateResetTimer);
    }
    celebrateResetTimer = setTimeout(() => {
      celebrateChoiceId = null;
      celebrateResetTimer = null;
    }, 760);
  };

  const submitVote = async (winnerId) => {
    if (busy || state !== "ready" || !matchup) return;
    const imageAId = matchup?.a?.id;
    const imageBId = matchup?.b?.id;
    if (!imageAId || !imageBId || !winnerId) return;

    busy = true;
    lastChoice = winnerId;
    triggerCelebrate(winnerId);
    const voteStartedAt = Date.now();
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

    const nextMatchup = await consumePrefetchedMatchup();

    if (nextMatchup) {
      const elapsed = Date.now() - voteStartedAt;
      const delay = Math.max(0, celebrationMinVisibleMs - elapsed);
      if (delay > 0) {
        await wait(delay);
      }
      matchup = nextMatchup;
      state = "ready";
      busy = false;
      loadingNext = false;
      statusMessage = "";
      lastChoice = null;
      celebrateChoiceId = null;
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
      celebrateChoiceId = null;
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
    if (celebrateResetTimer) {
      clearTimeout(celebrateResetTimer);
      celebrateResetTimer = null;
    }
  });
</script>

{#if state === "loading"}
  <div class="vote-header">
    <div class="vote-kicker">No ties. Pick one.</div>
    <div class="vote-shortcuts">A / L or Left / Right</div>
    <div class="vote-feedback" aria-hidden="true"></div>
  </div>
  <div class="vote-grid" aria-hidden="true">
    {#each ["A", "B"] as key}
      <div class="vote-card live skeleton-card">
        <div class="vote-key">{key}</div>
        <div class="vote-image skeleton"></div>
        <div class="vote-meta">
          <div class="vote-line skeleton"></div>
          <div class="vote-line short skeleton"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if state === "error"}
  <div class="vote-error">
    <div class="vote-header">
      <div class="vote-kicker">No ties. Pick one.</div>
      <div class="vote-shortcuts">A / L or Left / Right</div>
      <div class="vote-feedback" aria-hidden="true"></div>
    </div>
    <div class="vote-grid">
      <div class="vote-card">{errorMessage || "Matchup unavailable."}</div>
      <div class="vote-card">Try again.</div>
    </div>
    <button class="vote-retry" type="button" on:click={() => loadMatchup()}> Retry </button>
  </div>
{:else}
  <div class="vote-header">
    <div class="vote-kicker">No ties. Pick one.</div>
    <div class="vote-shortcuts">A / L or Left / Right</div>
    <div class="vote-feedback">
      {#if statusMessage}
        <div class="vote-status" role="status" aria-live="polite">{statusMessage}</div>
      {/if}
      {#if errorMessage}
        <div class="vote-alert" role="status" aria-live="polite">{errorMessage}</div>
      {/if}
    </div>
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
        {#if celebrateChoiceId === item?.id}
          <div class="vote-celebrate" aria-hidden="true">
            <div class="vote-stamp">WINNER</div>
            {#each confettiPieces as piece}
              <span
                class="vote-confetti"
                style={`--confetti-x:${piece.x}px;--confetti-y:${piece.y}px;--confetti-hue:${piece.hue};--confetti-delay:${piece.delay}ms;`}
              ></span>
            {/each}
          </div>
        {/if}
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

  .vote-feedback {
    min-height: 16px;
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
    position: relative;
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
    width: 100%;
    min-height: 42px;
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

  .vote-celebrate {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .vote-stamp {
    position: absolute;
    right: 14px;
    top: 14px;
    padding: 4px 9px;
    border-radius: 999px;
    border: 2px solid rgba(212, 90, 60, 0.85);
    background: rgba(255, 244, 230, 0.92);
    color: rgba(180, 60, 34, 0.95);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    transform: rotate(-9deg) scale(0.6);
    opacity: 0;
    animation: stamp-pop 320ms cubic-bezier(0.2, 1, 0.25, 1) forwards;
  }

  .vote-confetti {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 8px;
    height: 12px;
    border-radius: 2px;
    background: hsl(var(--confetti-hue) 92% 58%);
    transform: translate(-50%, -50%) rotate(0deg) scale(0.8);
    opacity: 0;
    animation: confetti-burst 640ms ease-out var(--confetti-delay) forwards;
  }

  .skeleton-card {
    pointer-events: none;
    cursor: default;
  }

  .vote-line {
    width: 72%;
    height: 14px;
    border-radius: 999px;
  }

  .vote-line.short {
    width: 46%;
    height: 12px;
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

  @keyframes stamp-pop {
    0% {
      transform: rotate(-9deg) scale(0.6);
      opacity: 0;
    }
    60% {
      transform: rotate(-9deg) scale(1.08);
      opacity: 1;
    }
    100% {
      transform: rotate(-9deg) scale(1);
      opacity: 1;
    }
  }

  @keyframes confetti-burst {
    0% {
      transform: translate(-50%, -50%) rotate(0deg) scale(0.75);
      opacity: 0.95;
    }
    100% {
      transform: translate(calc(-50% + var(--confetti-x)), calc(-50% + var(--confetti-y)))
        rotate(245deg) scale(1);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .vote-stamp,
    .vote-confetti {
      animation: none;
    }

    .vote-stamp {
      transform: rotate(-9deg) scale(1);
      opacity: 1;
    }

    .vote-confetti {
      display: none;
    }
  }
</style>

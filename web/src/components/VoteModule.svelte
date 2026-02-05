<script>
  import { onMount } from "svelte";

  export let apiBaseUrl = "http://localhost:8787";

  let state = "loading";
  let matchup = null;

  const pickImageUrl = (item) => {
    const variant =
      item?.variantUrls?.feed || item?.variantUrls?.full || item?.variantUrls?.thumb || {};
    return variant.webp || variant.avif || variant.jpg || variant.png || item?.originalUrl || "";
  };

  onMount(async () => {
    state = "loading";
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/matchups/next`);
      if (!response.ok) {
        state = "error";
        return;
      }
      matchup = await response.json();
      state = "ready";
    } catch (err) {
      state = "error";
    }
  });
</script>

{#if state === "loading"}
  <div class="vote-grid">
    <div class="vote-card skeleton"></div>
    <div class="vote-card skeleton"></div>
  </div>
{:else if state === "error"}
  <div class="vote-grid">
    <div class="vote-card">Matchup unavailable</div>
    <div class="vote-card">Try again later</div>
  </div>
{:else}
  <div class="vote-grid">
    {#each [matchup?.a, matchup?.b] as item}
      <div class="vote-card live">
        {#if pickImageUrl(item)}
          <img src={pickImageUrl(item)} alt={item?.title || "Junkmail matchup"} />
        {:else}
          <div class="vote-placeholder">Processing</div>
        {/if}
        <div class="vote-meta">
          <div class="vote-title">{item?.title || "Untitled"}</div>
          <div class="vote-subtle">Clicking goes live next phase.</div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .vote-card.live {
    padding: 16px;
    gap: 12px;
    align-content: start;
  }

  .vote-card img {
    width: 100%;
    max-height: 220px;
    object-fit: contain;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #fffdf9;
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

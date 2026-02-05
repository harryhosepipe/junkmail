<script>
  import { onMount } from "svelte";

  export let apiBaseUrl = "http://localhost:8787";

  let items = [];
  let state = "loading";

  const pickImageUrl = (item) => {
    const variant = item?.variantUrls?.feed || item?.variantUrls?.thumb || item?.variantUrls?.full || {};
    return variant.webp || variant.jpg || variant.png || item?.originalUrl || "";
  };

  const placeholders = Array.from({ length: 4 });

  onMount(async () => {
    state = "loading";
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/images/recent?limit=4`);
      if (!response.ok) {
        state = "error";
        return;
      }
      const data = await response.json();
      items = Array.isArray(data?.items) ? data.items : [];
      state = "ready";
    } catch (err) {
      state = "error";
    }
  });
</script>

{#if state === "loading"}
  <div class="grid" style="margin-top: 16px;">
    {#each placeholders as _}
      <div class="scan-card">
        <div class="scan-image skeleton"></div>
        <div class="scan-meta">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if state === "error"}
  <p class="subtle" style="margin-top: 12px;">Could not load recent scans.</p>
{:else if items.length === 0}
  <p class="subtle" style="margin-top: 12px;">No uploads yet.</p>
{:else}
  <div class="grid" style="margin-top: 16px;">
    {#each items as item}
      <a class="scan-card" href={`/image/${item.id}`}>
        <div class="scan-image">
          {#if pickImageUrl(item)}
            <img src={pickImageUrl(item)} alt={item.title || "Junkmail scan"} loading="lazy" />
          {:else}
            <div class="scan-placeholder">Processing</div>
          {/if}
        </div>
        <div class="scan-meta">
          <div class="scan-title">{item.title || "Untitled"}</div>
          {#if item.description}
            <p class="subtle">{item.description}</p>
          {/if}
        </div>
      </a>
    {/each}
  </div>
{/if}

<style>
  .scan-card {
    display: grid;
    gap: 12px;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: #fffcf7;
    color: inherit;
    text-decoration: none;
    box-shadow: var(--shadow);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .scan-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 30px -24px rgba(0, 0, 0, 0.4);
  }

  .scan-image {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 12px;
    overflow: hidden;
    background: #fffdf9;
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .scan-image img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    object-position: center;
    background: #fffdf9;
  }

  .scan-placeholder {
    color: var(--ink-muted);
    font-size: 14px;
  }

  .scan-meta {
    display: grid;
    gap: 6px;
  }

  .scan-title {
    font-weight: 700;
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

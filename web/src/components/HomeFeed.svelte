<script>
  import { onDestroy, onMount } from "svelte";
  import { convex } from "../lib/convex";

  export let apiBaseUrl = "http://localhost:8787";

  let items = [];
  let state = "loading";
  let baseItems = [];
  let unsubscribeRatings = null;

  const placeholders = Array.from({ length: 6 });

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

  const buildSrcset = (variants, format) => {
    if (!variants || !format) return "";
    const sizes = ["thumb", "feed", "full"];
    const entries = sizes
      .map((size) => {
        const variant = variants?.[size];
        const url = variant?.[format];
        const width = variant?.width;
        if (!url || !width) return "";
        return `${url} ${width}w`;
      })
      .filter(Boolean);
    return entries.join(", ");
  };

  const pickFallbackFormat = (variants) => {
    const sizes = ["feed", "full", "thumb"];
    for (const size of sizes) {
      const variant = variants?.[size];
      if (variant?.jpg) return "jpg";
      if (variant?.png) return "png";
    }
    return "";
  };

  const pickFallbackUrl = (variants, originalUrl) => {
    const sizes = ["feed", "full", "thumb"];
    for (const size of sizes) {
      const variant = variants?.[size];
      if (variant?.webp) return variant.webp;
      if (variant?.avif) return variant.avif;
      if (variant?.jpg) return variant.jpg;
      if (variant?.png) return variant.png;
    }
    return originalUrl || "";
  };

  const getImageSources = (item) => {
    const variants = normalizeVariants(item?.variantUrls);
    const fallbackFormat = pickFallbackFormat(variants);
    const fallbackSrc = pickFallbackUrl(variants, item?.originalUrl);
    return {
      fallbackSrc,
      fallbackSrcset: buildSrcset(variants, fallbackFormat),
      avifSrcset: buildSrcset(variants, "avif"),
      webpSrcset: buildSrcset(variants, "webp"),
    };
  };

  const mergeWithRatings = (ratings = []) => {
    const ratingById = new Map(
      ratings.map((rating) => [
        rating.imageId,
        {
          score: Number(rating?.score) || 0,
          votes: Number(rating?.comparisonsCount) || 0,
        },
      ])
    );

    items = baseItems.map((item) => {
      const rating = ratingById.get(item.id);
      return {
        ...item,
        score: rating?.score ?? Number(item?.score) ?? 0,
        votes: rating?.votes ?? Number(item?.votes) ?? 0,
      };
    });
  };

  const subscribeRatings = () => {
    if (unsubscribeRatings) {
      unsubscribeRatings();
      unsubscribeRatings = null;
    }

    const imageIds = baseItems.map((item) => item.id).filter(Boolean);
    if (!imageIds.length) {
      items = [];
      state = "ready";
      return;
    }

    unsubscribeRatings = convex.onUpdate(
      "voting:getRatingsByImageIds",
      { imageIds },
      (payload) => {
        const ratings = Array.isArray(payload?.ratings) ? payload.ratings : [];
        mergeWithRatings(ratings);
        state = "ready";
      },
      () => {
        state = "error";
      }
    );
  };

  onMount(async () => {
    state = "loading";
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/images/recent?limit=8`);
      if (!response.ok) {
        state = "error";
        return;
      }
      const data = await response.json();
      baseItems = Array.isArray(data?.items) ? data.items : [];
      items = baseItems;
      subscribeRatings();
      if (!baseItems.length) {
        state = "ready";
      }
    } catch {
      state = "error";
    }
  });

  onDestroy(() => {
    if (unsubscribeRatings) {
      unsubscribeRatings();
      unsubscribeRatings = null;
    }
  });
</script>

{#if state === "loading"}
  <div class="grid" style="margin-top: 16px;">
    {#each placeholders as _}
      <div class="feed-card">
        <div class="feed-image skeleton"></div>
        <div class="feed-meta">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if state === "error"}
  <p class="subtle" style="margin-top: 12px;">Could not load the feed.</p>
{:else if items.length === 0}
  <p class="subtle" style="margin-top: 12px;">No uploads yet.</p>
{:else}
  <div class="grid" style="margin-top: 16px;">
    {#each items as item}
      {@const sources = getImageSources(item)}
      <a class="feed-card" href={`/image/${item.id}`}>
        <div class="feed-image">
          {#if sources.fallbackSrc}
            <picture>
              {#if sources.avifSrcset}
                <source type="image/avif" srcset={sources.avifSrcset} sizes="(max-width: 900px) 100vw, 33vw" />
              {/if}
              {#if sources.webpSrcset}
                <source type="image/webp" srcset={sources.webpSrcset} sizes="(max-width: 900px) 100vw, 33vw" />
              {/if}
              <img
                src={sources.fallbackSrc}
                srcset={sources.fallbackSrcset}
                sizes="(max-width: 900px) 100vw, 33vw"
                alt={item?.title || "Junkmail scan"}
                loading="lazy"
                decoding="async"
              />
            </picture>
          {:else}
            <div class="feed-placeholder">Processing</div>
          {/if}
        </div>
        <div class="feed-meta">
          <div class="feed-title">{item?.title || "Untitled"}</div>
          <div class="feed-subtle">Appearances: {item?.votes ?? 0}</div>
        </div>
      </a>
    {/each}
  </div>
{/if}

<style>
  .feed-card {
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

  .feed-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 30px -24px rgba(0, 0, 0, 0.4);
  }

  .feed-image {
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

  .feed-image picture,
  .feed-image img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .feed-placeholder {
    color: var(--ink-muted);
    font-size: 14px;
  }

  .feed-meta {
    display: grid;
    gap: 6px;
  }

  .feed-title {
    font-weight: 700;
  }

  .feed-subtle {
    font-size: 12px;
    color: var(--ink-muted);
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

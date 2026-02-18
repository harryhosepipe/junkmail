<script>
  import { createEventDispatcher, tick } from "svelte";

  export let apiBaseUrl = "";
  export let imageId = "";
  export let open = false;

  const dispatch = createEventDispatcher();

  let loading = false;
  let errorMessage = "";
  let image = null;
  let viewer = null;
  let commentDraft = "";
  let commentError = "";
  let commentSaving = false;
  let overlayEl;
  let closeButtonEl;
  let previousBodyOverflow = "";
  let previousActiveElement = null;
  const COMMENT_MAX_LENGTH = 500;

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
    return sizes
      .map((size) => {
        const variant = variants?.[size];
        const url = variant?.[format];
        const width = variant?.width;
        if (!url || !width) return "";
        return `${url} ${width}w`;
      })
      .filter(Boolean)
      .join(", ");
  };

  const pickFallbackFormat = (variants) => {
    const sizes = ["full", "feed", "thumb"];
    for (const size of sizes) {
      const variant = variants?.[size];
      if (variant?.jpg) return "jpg";
      if (variant?.png) return "png";
    }
    return "";
  };

  const pickFallbackUrl = (variants, originalUrl) => {
    const sizes = ["full", "feed", "thumb"];
    for (const size of sizes) {
      const variant = variants?.[size];
      if (variant?.webp) return variant.webp;
      if (variant?.avif) return variant.avif;
      if (variant?.jpg) return variant.jpg;
      if (variant?.png) return variant.png;
    }
    return originalUrl || "";
  };

  const handleClose = () => {
    dispatch("close");
  };

  const trapFocus = (event) => {
    if (!open || event.key !== "Tab" || !overlayEl) return;
    const focusable = Array.from(
      overlayEl.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("disabled"));

    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleKeydown = (event) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      handleClose();
      return;
    }
    trapFocus(event);
  };

  const fetchImage = async () => {
    if (!open || !imageId) return;
    loading = true;
    errorMessage = "";
    image = null;
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/images/${imageId}`);
      if (!response.ok) {
        errorMessage = response.status === 404 ? "Image not found." : "Could not load image.";
        return;
      }
      image = await response.json();
    } catch {
      errorMessage = "Could not load image.";
    } finally {
      loading = false;
    }
  };

  const fetchViewer = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
        credentials: "include",
      });
      if (!response.ok) {
        viewer = null;
        return;
      }
      const data = await response.json();
      viewer = data?.user ?? null;
    } catch {
      viewer = null;
    }
  };

  const formatCommentDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const submitComment = async () => {
    if (!image?.id || commentSaving) return;
    const text = commentDraft.trim();
    if (!text) {
      commentError = "Comment cannot be empty.";
      return;
    }
    if (text.length > COMMENT_MAX_LENGTH) {
      commentError = `Comment cannot exceed ${COMMENT_MAX_LENGTH} characters.`;
      return;
    }

    commentSaving = true;
    commentError = "";
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/images/${image.id}/comments`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        commentError = data?.error?.message || "Could not post comment.";
        return;
      }
      const nextComment = data?.comment;
      if (!nextComment) {
        commentError = "Could not post comment.";
        return;
      }
      image = {
        ...image,
        comments: [...(Array.isArray(image?.comments) ? image.comments : []), nextComment],
      };
      commentDraft = "";
    } catch {
      commentError = "Could not post comment.";
    } finally {
      commentSaving = false;
    }
  };

  const lockScroll = () => {
    if (typeof document === "undefined") return;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  };

  const restoreScroll = () => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = previousBodyOverflow;
  };

  $: if (open && imageId) {
    fetchImage();
    fetchViewer();
  }

  $: if (open) {
    previousActiveElement = typeof document !== "undefined" ? document.activeElement : null;
    lockScroll();
    tick().then(() => {
      closeButtonEl?.focus();
    });
  }

  $: if (!open) {
    restoreScroll();
    if (previousActiveElement && typeof previousActiveElement.focus === "function") {
      previousActiveElement.focus();
    }
    previousActiveElement = null;
  }

  $: variants = normalizeVariants(image?.variantUrls);
  $: fallbackFormat = pickFallbackFormat(variants);
  $: imageSrc = pickFallbackUrl(variants, image?.originalUrl);
  $: avifSrcset = buildSrcset(variants, "avif");
  $: webpSrcset = buildSrcset(variants, "webp");
  $: fallbackSrcset = buildSrcset(variants, fallbackFormat);
</script>

{#if open}
  <div
    class="detail-overlay"
    bind:this={overlayEl}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    on:keydown={handleKeydown}
  >
    <button
      class="detail-backdrop"
      type="button"
      aria-label="Close image detail"
      on:click={handleClose}
    ></button>

    <section class="detail-modal panel">
      <header class="detail-header">
        <div class="detail-title">
          {image?.title || (imageId ? `Image #${imageId}` : "Image detail")}
        </div>
        <button
          class="detail-close"
          type="button"
          aria-label="Close"
          bind:this={closeButtonEl}
          on:click={handleClose}
        >
          ×
        </button>
      </header>

      {#if loading}
        <div class="detail-loading">Loading image…</div>
      {:else if errorMessage}
        <div class="detail-empty">{errorMessage}</div>
      {:else if image}
        <div class="detail-layout">
          <div class="detail-image">
            {#if image?.status === "public" && imageSrc}
              <picture>
                {#if avifSrcset}
                  <source
                    type="image/avif"
                    srcset={avifSrcset}
                    sizes="(max-width: 900px) 100vw, 72vw"
                  />
                {/if}
                {#if webpSrcset}
                  <source
                    type="image/webp"
                    srcset={webpSrcset}
                    sizes="(max-width: 900px) 100vw, 72vw"
                  />
                {/if}
                <img
                  src={imageSrc}
                  srcset={fallbackSrcset}
                  sizes="(max-width: 900px) 100vw, 72vw"
                  alt={image?.title || "Junkmail image"}
                  loading="eager"
                  decoding="async"
                />
              </picture>
            {:else}
              <div class="detail-processing">Processing</div>
            {/if}
          </div>

          <div class="detail-meta">
            <p class="detail-description">
              {image?.description || "One piece of mail, judged without mercy."}
            </p>
            <div class="detail-stat">Uploaded by</div>
            <div class="detail-value detail-value-sm">{image?.uploaderAlias || "Unknown"}</div>
            <div class="detail-stat">Appearances</div>
            <div class="detail-value">{Number(image?.votes ?? 0)}</div>
            <div class="detail-stat">Score</div>
            <div class="detail-value">{Number(image?.score ?? 0).toFixed(2)}</div>
            <div class="detail-stat" style="margin-top: 10px;">Comments</div>
            <div class="comments-wrap">
              {#if Array.isArray(image?.comments) && image.comments.length}
                {#each image.comments as comment}
                  <article class="comment-row">
                    <div class="comment-meta">
                      <span class="comment-author">{comment?.userAlias || "Unknown"}</span>
                      <span>{formatCommentDate(comment?.createdAt)}</span>
                    </div>
                    <p>{comment?.body || ""}</p>
                  </article>
                {/each}
              {:else}
                <div class="comment-empty">No comments yet.</div>
              {/if}
            </div>
            {#if viewer}
              <label class="comment-label" for="comment-draft">Add comment</label>
              <textarea
                id="comment-draft"
                class="comment-input"
                bind:value={commentDraft}
                maxlength={COMMENT_MAX_LENGTH}
                rows="3"
                placeholder="Say something about this junkmail..."
              ></textarea>
              <div class="comment-footer">
                <span>{commentDraft.trim().length}/{COMMENT_MAX_LENGTH}</span>
                <button
                  type="button"
                  class="detail-btn"
                  disabled={commentSaving}
                  on:click={submitComment}
                >
                  {commentSaving ? "Posting..." : "Post comment"}
                </button>
              </div>
              {#if commentError}
                <div class="comment-error">{commentError}</div>
              {/if}
            {:else}
              <a class="comment-login" href="/login">Log in to comment</a>
            {/if}
            <div class="detail-actions">
              <button type="button" class="detail-btn" on:click={handleClose}>Back</button>
              <a class="detail-link" href={`/image/${image.id}`}>Open page</a>
            </div>
          </div>
        </div>
      {/if}
    </section>
  </div>
{/if}

<style>
  .detail-overlay {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .detail-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(24, 14, 6, 0.56);
    backdrop-filter: blur(2px);
    cursor: pointer;
  }

  .detail-modal {
    position: relative;
    width: min(1080px, 100%);
    max-height: min(92vh, 860px);
    overflow: auto;
    border-radius: 18px;
    border: 1px solid var(--border);
    box-shadow: 0 36px 80px -42px rgba(0, 0, 0, 0.75);
    animation: modal-in 0.18s ease;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .detail-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--bg-ink);
    overflow-wrap: anywhere;
  }

  .detail-close {
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #fffdf9;
    color: var(--bg-ink);
    font-size: 26px;
    line-height: 1;
    cursor: pointer;
  }

  .detail-loading,
  .detail-empty {
    padding: 24px;
    border-radius: 14px;
    border: 1px dashed var(--border);
    color: var(--ink-muted);
    background: #fffdf9;
  }

  .detail-layout {
    display: grid;
    grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .detail-image {
    width: 100%;
    min-height: 320px;
    max-height: 70vh;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: #fffdf9;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .detail-image picture,
  .detail-image img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .detail-processing {
    color: var(--ink-muted);
    font-size: 14px;
  }

  .detail-meta {
    display: grid;
    gap: 8px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: #fffcf7;
  }

  .detail-description {
    margin: 0 0 8px;
    color: var(--ink-muted);
  }

  .detail-stat {
    font-size: 12px;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .detail-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--bg-ink);
  }

  .detail-value-sm {
    font-size: 18px;
  }

  .detail-actions {
    margin-top: 6px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .comments-wrap {
    display: grid;
    gap: 8px;
    max-height: 220px;
    overflow: auto;
    padding-right: 4px;
  }

  .comment-row {
    margin: 0;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #fffefc;
  }

  .comment-row p {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--bg-ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .comment-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .comment-author {
    color: var(--bg-ink);
    font-weight: 700;
  }

  .comment-empty {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .comment-label {
    margin-top: 4px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-muted);
  }

  .comment-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    font: inherit;
    color: var(--bg-ink);
    background: white;
    resize: vertical;
  }

  .comment-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
    color: var(--ink-muted);
  }

  .comment-error {
    font-size: 13px;
    color: #9a2e1f;
  }

  .comment-login {
    font-size: 13px;
    color: var(--bg-ink);
  }

  .detail-btn,
  .detail-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #fffdf9;
    color: var(--bg-ink);
    text-decoration: none;
    font-weight: 600;
    cursor: pointer;
  }

  @keyframes modal-in {
    from {
      transform: translateY(8px) scale(0.99);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  @media (max-width: 900px) {
    .detail-overlay {
      padding: 12px;
    }

    .detail-layout {
      grid-template-columns: 1fr;
    }
  }
</style>

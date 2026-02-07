<script>
  import { onDestroy, onMount } from "svelte";

  export let apiBaseUrl = "http://localhost:8787";
  export let initialUser = null;

  let authState = initialUser ? "authed" : "guest";
  let userEmail = initialUser?.email ?? "";
  let userRole = initialUser?.role ?? "";
  let title = "";
  let description = "";
  let file = null;
  let fileInput = null;
  let status = "";
  let statusState = "info";
  let uploading = false;
  let previewUrl = "";
  let previewTitle = "";
  let previewDescription = "";
  let previewVisible = false;
  let localPreviewUrl = "";
  let localPreviewName = "";
  let displayPreviewUrl = "";
  let displayPreviewTitle = "";
  let displayPreviewDescription = "";
  let displayPreviewLabel = "";

  const setStatus = (message, mode = "info") => {
    status = message;
    statusState = mode;
  };

  const resetPreview = () => {
    previewVisible = false;
    previewUrl = "";
    previewTitle = "";
    previewDescription = "";
  };

  const clearLocalPreview = () => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    localPreviewUrl = "";
    localPreviewName = "";
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    file = nextFile;
    resetPreview();
    clearLocalPreview();

    if (!nextFile) {
      return;
    }

    localPreviewUrl = URL.createObjectURL(nextFile);
    localPreviewName = nextFile.name;
  };

  const loadSession = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
        credentials: "include",
      });
      if (!response.ok) {
        authState = "guest";
        return;
      }
      const data = await response.json();
      userEmail = data?.user?.email || "";
      userRole = data?.user?.role || "";
      authState = "authed";
    } catch (err) {
      authState = "guest";
    }
  };

  const pollImage = async (imageId, meta) => {
    const maxAttempts = 40;
    const interval = 3000;
    let attempts = 0;

    const tick = async () => {
      attempts += 1;
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/images/${imageId}`);
        if (!response.ok) {
          throw new Error("fetch failed");
        }
        const data = await response.json();
        if (data.status === "public") {
          const variant = data?.variantUrls?.feed || data?.variantUrls?.full || {};
          const imageUrl = variant.webp || variant.jpg || variant.png || data.originalUrl;
          if (imageUrl) {
            previewUrl = imageUrl;
            previewTitle = data.title || meta.title || "Untitled";
            previewDescription = data.description || meta.description || "";
            previewVisible = true;
            clearLocalPreview();
            setStatus("Image is public.", "success");
            return;
          }
        }

        if (attempts < maxAttempts) {
          setStatus("Processing image...", "info");
          setTimeout(tick, interval);
        } else {
          setStatus("Still processing. Check back soon.", "info");
        }
      } catch (err) {
        if (attempts < maxAttempts) {
          setTimeout(tick, interval);
        } else {
          setStatus("Could not confirm processing status.", "error");
        }
      }
    };

    tick();
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus("Select a file first.", "error");
      return;
    }

    if (!/[.]jpe?g$/i.test(file.name) && !/[.]png$/i.test(file.name)) {
      setStatus("Only JPG or PNG files are allowed.", "error");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setStatus("File is larger than 15MB.", "error");
      return;
    }

    uploading = true;
    resetPreview();
    setStatus("Uploading...", "info");

    try {
      const formData = new FormData();
      if (title.trim()) formData.append("title", title.trim());
      if (description.trim()) formData.append("description", description.trim());
      formData.append("file", file);

      const response = await fetch(`${apiBaseUrl}/api/v1/images`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        setStatus("Session expired. Request a new link.", "error");
        authState = "guest";
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data?.error?.message || "Upload failed.", "error");
        return;
      }

      const imageId = data?.id;
      setStatus("Upload received. Processing image...", "success");
      if (imageId) {
        pollImage(imageId, { title: title.trim(), description: description.trim() });
      }

      title = "";
      description = "";
      file = null;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (err) {
      setStatus("Upload failed. Try again.", "error");
    } finally {
      uploading = false;
    }
  };

  const handleLogout = async () => {
    setStatus("Signing out...", "info");
    try {
      await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      authState = "guest";
      setStatus("Signed out.", "success");
    } catch (err) {
      setStatus("Sign out failed.", "error");
    }
  };

  onMount(() => {
    if (!initialUser) {
      loadSession();
    }
  });

  onDestroy(() => {
    clearLocalPreview();
  });

  $: {
    if (previewVisible && previewUrl) {
      displayPreviewUrl = previewUrl;
      displayPreviewTitle = previewTitle || "Public preview";
      displayPreviewDescription = previewDescription || "";
      displayPreviewLabel = "Public";
    } else if (localPreviewUrl) {
      displayPreviewUrl = localPreviewUrl;
      displayPreviewTitle = title.trim() || localPreviewName || "Selected image";
      displayPreviewDescription = description.trim();
      displayPreviewLabel = "Local";
    } else {
      displayPreviewUrl = "";
      displayPreviewTitle = "";
      displayPreviewDescription = "";
      displayPreviewLabel = "";
    }
  }
</script>

{#if authState === "guest"}
  <div class="auth-state">
    <p class="subtle">You need a magic link to upload.</p>
    <a class="cta" href="/login">Request access</a>
  </div>
{:else}
  <div class="auth-state">
    <p class="subtle">{userEmail ? `Signed in as ${userEmail}` : "Signed in"}</p>
    {#if userRole !== "uploader"}
      <p class="subtle">Your account is signed in but does not have uploader access.</p>
    {:else}
      <div class="upload-layout">
        <form class="upload-form" on:submit|preventDefault={handleUpload}>
          <label class="field">
            <span>Title</span>
            <input
              type="text"
              name="title"
              placeholder="e.g. Final notice envelope"
              maxlength="120"
              bind:value={title}
            />
          </label>
          <label class="field">
            <span>Description</span>
            <textarea
              name="description"
              rows="3"
              placeholder="Optional notes for the gallery."
              maxlength="500"
              bind:value={description}
            ></textarea>
          </label>
          <label class="field">
            <span>Image file</span>
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png"
              bind:this={fileInput}
              on:change={handleFileChange}
              required
            />
          </label>
          <p class="hint">JPG or PNG, up to 15MB.</p>
          <button class="cta" type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload image"}
          </button>
        </form>
        <aside class="preview-panel" aria-live="polite">
          <div class="preview-header">
            <span>Preview</span>
            {#if displayPreviewLabel}
              <span class="preview-chip">{displayPreviewLabel}</span>
            {/if}
          </div>
          {#if displayPreviewUrl}
            <img class="preview-image" src={displayPreviewUrl} alt="Selected junkmail" />
            <div class="preview-meta">
              <div class="headline">{displayPreviewTitle}</div>
              {#if displayPreviewDescription}
                <p class="subtle">{displayPreviewDescription}</p>
              {/if}
            </div>
          {:else}
            <div class="preview-placeholder">Select an image to see a preview here.</div>
          {/if}
        </aside>
      </div>
    {/if}
    {#if status}
      <p
        class={`status ${
          statusState === "error" ? "error" : statusState === "success" ? "success" : ""
        }`}
      >
        {status}
      </p>
    {/if}
    <button class="cta" type="button" on:click={handleLogout}> Log out </button>
  </div>
{/if}

<style>
  .auth-state {
    display: grid;
    gap: 12px;
  }

  .upload-form {
    display: grid;
    gap: 12px;
    max-width: 420px;
  }

  .upload-layout {
    display: grid;
    gap: 24px;
    align-items: start;
    grid-template-columns: minmax(0, 1fr) minmax(0, 360px);
  }

  @media (max-width: 900px) {
    .upload-layout {
      grid-template-columns: 1fr;
    }

    .upload-form {
      max-width: none;
    }
  }

  .field {
    display: grid;
    gap: 8px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .field input[type="file"] {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #fffdf9;
    font-size: 14px;
    color: var(--bg-ink);
  }

  .field textarea,
  .field input[type="text"] {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #fffdf9;
    font-size: 15px;
    color: var(--bg-ink);
    font-family: inherit;
  }

  .hint {
    color: var(--ink-muted);
    font-size: 14px;
    margin: 0;
  }

  .status {
    font-weight: 600;
    color: var(--accent-strong);
  }

  .status.error {
    color: #8a2e1c;
  }

  .status.success {
    color: #2f6f3b;
  }

  .preview-panel {
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 18px;
    background: #fffcf7;
    box-shadow: var(--shadow);
    display: grid;
    gap: 12px;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .preview-chip {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #fffdf9;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .preview-placeholder {
    min-height: 220px;
    border-radius: 14px;
    border: 1px dashed var(--border);
    display: grid;
    place-items: center;
    color: var(--ink-muted);
    padding: 12px;
    text-align: center;
  }

  .preview-image {
    width: 100%;
    max-height: 420px;
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    background: #fffdf9;
    object-fit: contain;
  }

  .preview-meta {
    display: grid;
    gap: 8px;
  }
</style>

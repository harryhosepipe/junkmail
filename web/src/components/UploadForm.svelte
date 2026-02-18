<script>
  import { onDestroy, onMount } from "svelte";

  export let apiBaseUrl = "";
  export let initialUser = null;

  let authState = initialUser ? "authed" : "guest";
  let userEmail = initialUser?.email ?? "";
  let userRole = initialUser?.role ?? "";
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
  let duplicateModalOpen = false;
  let duplicateModalType = "exact";
  let duplicateMessage = "";
  let duplicateExisting = null;
  const fileInputId = "upload-file-input";
  const ACCEPTED_IMAGE_MIMES = new Set(["image/jpeg", "image/png"]);

  const setStatus = (message, mode = "info") => {
    status = message;
    statusState = mode;
  };

  const closeDuplicateModal = () => {
    duplicateModalOpen = false;
    duplicateModalType = "exact";
    duplicateMessage = "";
    duplicateExisting = null;
  };

  const openDuplicateModal = (payload) => {
    const type = payload?.duplicateType === "near" ? "near" : "exact";
    duplicateModalType = type;
    duplicateExisting = payload?.existing || null;
    duplicateMessage =
      payload?.error?.message ||
      (type === "near"
        ? "This upload is too similar to an existing image."
        : "This exact image has already been uploaded.");
    duplicateModalOpen = true;
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

  const clearSelectedFile = () => {
    file = null;
    resetPreview();
    clearLocalPreview();
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const releaseSelectedFile = () => {
    file = null;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const setSelectedFile = (nextFile) => {
    file = nextFile;
    resetPreview();
    clearLocalPreview();

    if (!nextFile) {
      return;
    }

    localPreviewUrl = URL.createObjectURL(nextFile);
    localPreviewName =
      nextFile.name || (nextFile.type === "image/png" ? "pasted-image.png" : "pasted-image.jpg");
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setSelectedFile(nextFile);
  };

  const isTextLikeTarget = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (target.tagName === "TEXTAREA") return true;
    if (target.tagName !== "INPUT") return false;
    const inputType = (target.type || "").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "file"].includes(inputType);
  };

  const handlePaste = (event) => {
    if (isTextLikeTarget(event.target)) return;
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find(
      (item) => item.kind === "file" && ACCEPTED_IMAGE_MIMES.has((item.type || "").toLowerCase()),
    );
    if (!imageItem) return;

    const pastedFile = imageItem.getAsFile();
    if (!pastedFile) return;

    event.preventDefault();
    setSelectedFile(pastedFile);
    setStatus("Pasted image ready to upload.", "info");
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

  const fetchImageDetail = async (imageId) => {
    const response = await fetch(`${apiBaseUrl}/api/v1/images/${imageId}`);
    if (!response.ok) return null;
    return response.json();
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
            previewTitle = data.title || "Untitled";
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

  const pollUploadStatus = async (uploadId, imageId, meta) => {
    const maxAttempts = 40;
    const interval = 3000;
    let attempts = 0;

    const tick = async () => {
      attempts += 1;
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/uploads/${uploadId}/status`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("status fetch failed");

        const payload = await response.json();
        if (payload?.status === "rejected") {
          let matched = null;
          if (payload?.matchedImageId) {
            const detail = await fetchImageDetail(payload.matchedImageId);
            if (detail) {
              matched = {
                id: detail.id,
                status: detail.status,
                originalUrl:
                  detail?.variantUrls?.feed?.webp ||
                  detail?.variantUrls?.feed?.jpg ||
                  detail?.variantUrls?.feed?.png ||
                  detail?.originalUrl ||
                  "",
                title: detail.title || null,
                createdAt: detail.createdAt || null,
                uploaderAlias: detail.uploaderAlias || null,
              };
            }
          }
          openDuplicateModal({
            duplicateType: "near",
            existing: matched || {
              id: payload?.matchedImageId || null,
              status: "rejected",
              originalUrl: "",
              title: null,
              createdAt: null,
              uploaderAlias: null,
            },
            error: {
              message:
                payload?.rejectReason ||
                "Upload rejected because this image already exists in the library.",
            },
          });
          setStatus("Duplicate detected and blocked.", "error");
          return;
        }

        if (payload?.status === "public") {
          await pollImage(imageId, meta);
          return;
        }

        if (attempts < maxAttempts) {
          setStatus("Processing image...", "info");
          setTimeout(tick, interval);
        } else {
          setStatus("Still processing. Check back soon.", "info");
        }
      } catch (_err) {
        if (attempts < maxAttempts) {
          setTimeout(tick, interval);
        } else {
          setStatus("Could not confirm processing status.", "error");
        }
      }
    };

    tick();
  };

  const uploadLegacy = async ({ currentDescription }) => {
    const formData = new FormData();
    if (currentDescription) formData.append("description", currentDescription);
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
      if (response.status === 409 && data?.duplicate && data?.duplicateType === "near") {
        openDuplicateModal(data);
        setStatus("Near-duplicate blocked.", "error");
        return;
      }
      setStatus(data?.error?.message || "Upload failed.", "error");
      return;
    }

    const imageId = data?.id;
    if (data?.duplicate) {
      openDuplicateModal(data);
      setStatus("Duplicate detected. Showing existing item details.", "info");
    } else {
      setStatus("Upload received. Processing image...", "success");
    }
    if (imageId) {
      pollImage(imageId, { description: currentDescription });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus("Select a file first.", "error");
      return;
    }

    const fileName = (file.name || "").toLowerCase();
    const fileType = (file.type || "").toLowerCase();
    const hasAllowedExt = /[.]jpe?g$/i.test(fileName) || /[.]png$/i.test(fileName);
    const hasAllowedType = ACCEPTED_IMAGE_MIMES.has(fileType);

    if (!hasAllowedExt && !hasAllowedType) {
      setStatus("Only JPG or PNG files are allowed.", "error");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setStatus("File is larger than 15MB.", "error");
      return;
    }

    uploading = true;
    setStatus("Uploading...", "info");

    try {
      const currentDescription = description.trim();
      const initResponse = await fetch(`${apiBaseUrl}/api/v1/uploads/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          description: currentDescription || undefined,
          mime: fileType || undefined,
          size: file.size,
          filename: file.name || undefined,
        }),
      });

      if (initResponse.status === 404 || initResponse.status === 405) {
        await uploadLegacy({ currentDescription });
      } else {
        if (initResponse.status === 401 || initResponse.status === 403) {
          setStatus("Session expired. Request a new link.", "error");
          authState = "guest";
          return;
        }
        if (!initResponse.ok) {
          const errorData = await initResponse.json().catch(() => ({}));
          setStatus(errorData?.error?.message || "Could not initialize upload.", "error");
          return;
        }

        const initData = await initResponse.json();
        const uploadId = initData?.uploadId;
        const imageId = initData?.imageId;
        if (!uploadId || !imageId) {
          setStatus("Upload initialization response was invalid.", "error");
          return;
        }

        const completeForm = new FormData();
        completeForm.append("uploadId", uploadId);
        if (currentDescription) completeForm.append("description", currentDescription);
        completeForm.append("file", file);

        const completeResponse = await fetch(`${apiBaseUrl}/api/v1/uploads/complete`, {
          method: "POST",
          body: completeForm,
          credentials: "include",
        });
        if (completeResponse.status === 401 || completeResponse.status === 403) {
          setStatus("Session expired. Request a new link.", "error");
          authState = "guest";
          return;
        }
        if (!completeResponse.ok) {
          const errorData = await completeResponse.json().catch(() => ({}));
          setStatus(errorData?.error?.message || "Upload failed.", "error");
          return;
        }

        setStatus("Upload received. Processing image...", "success");
        pollUploadStatus(uploadId, imageId, {
          description: currentDescription,
        });
      }

      description = "";
      // Keep local preview visible while processing and only swap when public image is ready.
      releaseSelectedFile();
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
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
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
      displayPreviewTitle = localPreviewName || "Selected image";
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
    {#if userRole !== "uploader" && userRole !== "admin"}
      <p class="subtle">Your account is signed in but does not have uploader access.</p>
    {:else}
      <div class="upload-layout">
        <form class="upload-form" on:submit|preventDefault={handleUpload}>
          <div class="field">
            <label for={fileInputId}>
              <span>Image file</span>
            </label>
            <input
              id={fileInputId}
              type="file"
              name="file"
              accept="image/jpeg,image/png"
              class="visually-hidden"
              bind:this={fileInput}
              on:change={handleFileChange}
            />
            <label for={fileInputId} class="file-cta">
              <span class="file-cta-main"
                >{file ? "Pick a different image" : "Pick your junkmail image"}</span
              >
              <span class="file-cta-sub"
                >JPG or PNG, up to 15MB. You can also paste (Ctrl/Cmd+V).</span
              >
            </label>
            {#if file}
              <div class="file-selected">
                <div class="file-chip" aria-live="polite">{file.name}</div>
                <button
                  type="button"
                  class="file-remove"
                  on:click={() => {
                    clearSelectedFile();
                    setStatus("Image selection cleared.", "info");
                  }}
                >
                  Remove image
                </button>
              </div>
            {/if}
          </div>
          {#if file}
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
          {/if}
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
            <div class="preview-media">
              <img class="preview-image" src={displayPreviewUrl} alt="Selected junkmail" />
            </div>
            <div class="preview-meta">
              <div class="preview-title">{displayPreviewTitle}</div>
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

{#if duplicateModalOpen}
  <div class="duplicate-modal-backdrop" role="presentation" on:click|self={closeDuplicateModal}>
    <div
      class="duplicate-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Duplicate image detected"
      tabindex="0"
      on:keydown={(event) => {
        if (event.key === "Escape") closeDuplicateModal();
      }}
    >
      <div class="duplicate-modal-title">
        {duplicateModalType === "near" ? "Near Duplicate Blocked" : "Image Already Uploaded"}
      </div>
      <p class="duplicate-modal-copy">{duplicateMessage}</p>
      {#if duplicateExisting?.originalUrl}
        <img
          class="duplicate-modal-image"
          src={duplicateExisting.originalUrl}
          alt="Previously uploaded similar item"
        />
      {/if}
      <div class="duplicate-meta">
        <div>Uploaded: {duplicateExisting?.createdAt || "Unknown"}</div>
        <div>By: {duplicateExisting?.uploaderAlias || "Unknown"}</div>
        <div>Status: {duplicateExisting?.status || "Unknown"}</div>
        <div>ID: {duplicateExisting?.id || "Unknown"}</div>
      </div>
      <button class="cta" type="button" on:click={closeDuplicateModal}>Close</button>
    </div>
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

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .file-cta {
    display: grid;
    gap: 4px;
    width: 100%;
    padding: 16px 18px;
    border-radius: 14px;
    border: 1px solid var(--border);
    text-align: left;
    background: #1f2436;
    cursor: pointer;
    color: var(--bg-ink);
    box-shadow: 0 10px 22px -18px rgba(212, 90, 60, 0.7);
    transition:
      transform 0.16s ease,
      box-shadow 0.16s ease,
      border-color 0.16s ease;
  }

  .file-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 28px -22px rgba(212, 90, 60, 0.85);
    border-color: rgba(212, 90, 60, 0.45);
  }

  .file-cta:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .file-cta-main {
    font-size: 16px;
    font-weight: 700;
  }

  .file-cta-sub {
    font-size: 13px;
    color: var(--ink-muted);
  }

  .file-chip {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #23293d;
    font-size: 12px;
    color: var(--ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-selected {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .file-remove {
    border: 1px solid var(--border);
    border-radius: 999px;
    background: #1f2436;
    color: var(--ink-muted);
    font-size: 12px;
    font-weight: 600;
    padding: 6px 10px;
    cursor: pointer;
  }

  .file-remove:hover {
    border-color: rgba(212, 90, 60, 0.45);
    color: var(--accent-strong);
  }

  .field textarea,
  .field input[type="text"] {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #1f2436;
    font-size: 15px;
    color: var(--bg-ink);
    font-family: inherit;
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
    background: #23293d;
    box-shadow: var(--shadow);
    display: grid;
    gap: 12px;
    min-width: 0;
    overflow: hidden;
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
    background: #1f2436;
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

  .preview-media {
    width: 100%;
    min-height: 0;
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    background: #1f2436;
    display: grid;
    place-items: center;
    overflow: hidden;
    padding: 8px;
    box-sizing: border-box;
  }

  .preview-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
  }

  @media (max-width: 900px) {
    .preview-media {
      height: 220px;
    }
  }

  .preview-meta {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .preview-title {
    font-size: 24px;
    line-height: 1.2;
    font-weight: 700;
    color: var(--bg-ink);
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .duplicate-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 14, 10, 0.48);
    display: grid;
    place-items: center;
    padding: 16px;
    z-index: 60;
  }

  .duplicate-modal {
    width: min(560px, 100%);
    border-radius: 18px;
    border: 1px solid var(--border);
    background: #1f2436;
    box-shadow: var(--shadow);
    padding: 18px;
    display: grid;
    gap: 12px;
  }

  .duplicate-modal-title {
    font-size: 24px;
    font-weight: 700;
  }

  .duplicate-modal-copy {
    margin: 0;
    color: var(--ink-muted);
  }

  .duplicate-modal-image {
    width: 100%;
    max-height: 260px;
    object-fit: contain;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #1f2436;
  }

  .duplicate-meta {
    display: grid;
    gap: 4px;
    color: var(--ink-muted);
    font-size: 14px;
  }
</style>

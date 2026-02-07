<script>
  import { onMount } from "svelte";

  export let apiBaseUrl = "";

  let loading = true;
  let saving = false;
  let errorMessage = "";
  let successMessage = "";
  let profile = null;
  let aliasDraft = "";

  const formatDate = (value) => {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const loadProfile = async () => {
    loading = true;
    errorMessage = "";
    successMessage = "";
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/profile`, {
        credentials: "include",
      });
      if (!response.ok) {
        errorMessage = response.status === 401 ? "You need to log in." : "Could not load profile.";
        return;
      }
      const data = await response.json();
      profile = data?.profile ?? null;
      aliasDraft = profile?.alias ?? "";
    } catch {
      errorMessage = "Could not load profile.";
    } finally {
      loading = false;
    }
  };

  const saveAlias = async () => {
    if (!aliasDraft.trim()) {
      errorMessage = "Alias is required.";
      successMessage = "";
      return;
    }

    saving = true;
    errorMessage = "";
    successMessage = "";
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alias: aliasDraft }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        errorMessage = data?.error?.message || "Could not save profile.";
        return;
      }
      profile = {
        ...(profile ?? {}),
        ...(data?.profile ?? {}),
        alias: data?.profile?.alias ?? aliasDraft.trim(),
      };
      aliasDraft = profile?.alias ?? aliasDraft.trim();
      successMessage = "Profile updated.";
    } catch {
      errorMessage = "Could not save profile.";
    } finally {
      saving = false;
    }
  };

  onMount(async () => {
    await loadProfile();
  });
</script>

{#if loading}
  <div class="detail-empty">Loading profile...</div>
{:else if !profile}
  <div class="detail-empty">
    {errorMessage || "You need to log in to view your profile."}
    <div style="margin-top: 12px;">
      <a href="/login">Go to login</a>
    </div>
  </div>
{:else}
  <div class="profile-grid">
    <div class="profile-meta">
      <label class="detail-stat" for="alias-input">Alias</label>
      <input
        id="alias-input"
        class="alias-input"
        type="text"
        bind:value={aliasDraft}
        minlength="2"
        maxlength="32"
        pattern="[A-Za-z0-9_-]+"
        autocomplete="nickname"
      />
      <button class="save-btn" type="button" on:click={saveAlias} disabled={saving}>
        {saving ? "Saving..." : "Save alias"}
      </button>

      <div class="detail-stat">Email</div>
      <div class="detail-value detail-value-sm">{profile.email}</div>

      <div class="detail-stat">Signed up</div>
      <div class="detail-value detail-value-sm">{formatDate(profile.createdAt)}</div>
    </div>

    <div class="profile-stats">
      <div class="detail-stat">Votes cast</div>
      <div class="detail-value">{Number(profile.votesCast ?? 0)}</div>

      <div class="detail-stat">Images uploaded</div>
      <div class="detail-value">{Number(profile.uploadedImages ?? 0)}</div>
    </div>
  </div>

  {#if errorMessage}
    <div class="profile-message error">{errorMessage}</div>
  {/if}
  {#if successMessage}
    <div class="profile-message success">{successMessage}</div>
  {/if}
{/if}

<style>
  .profile-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 16px;
  }

  .profile-meta,
  .profile-stats {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px;
    background: #fffcf7;
    display: grid;
    gap: 8px;
    box-shadow: var(--shadow);
  }

  .detail-stat {
    font-size: 12px;
    color: var(--ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-top: 2px;
  }

  .detail-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--bg-ink);
  }

  .detail-value-sm {
    font-size: 16px;
    word-break: break-word;
  }

  .alias-input {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    font: inherit;
    color: var(--bg-ink);
    background: white;
  }

  .save-btn {
    width: fit-content;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 8px 14px;
    font: inherit;
    background: #fff5e3;
    color: var(--bg-ink);
    cursor: pointer;
  }

  .save-btn:disabled {
    opacity: 0.65;
    cursor: progress;
  }

  .profile-message {
    margin-top: 14px;
    border-radius: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    font-size: 14px;
  }

  .profile-message.error {
    background: #fff3f0;
    color: #9a2e1f;
  }

  .profile-message.success {
    background: #eefaf1;
    color: #1f6b37;
  }

  .detail-empty {
    padding: 24px;
    border-radius: 16px;
    border: 1px dashed var(--border);
    background: #fffdf9;
    color: var(--ink-muted);
  }

  @media (max-width: 900px) {
    .profile-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

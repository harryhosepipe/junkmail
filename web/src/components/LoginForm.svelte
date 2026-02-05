<script>
  export let apiBaseUrl = "http://localhost:8787";
  export let error = "";

  let email = "";
  let status = "";
  let statusState = "info";
  let sending = false;

  const setStatus = (message, mode = "info") => {
    status = message;
    statusState = mode;
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setStatus("Email required.", "error");
      return;
    }

    sending = true;
    setStatus("Sending magic link...", "info");

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/request-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), next: "/upload" })
      });

      if (!response.ok) {
        let message = "Request failed.";
        try {
          const data = await response.clone().json();
          message = data?.error?.message || message;
        } catch {
          try {
            const text = await response.text();
            if (text) message = text;
          } catch {
            // ignore
          }
        }
        setStatus(message, "error");
        return;
      }

      setStatus("If you're invited, check your email for the link.", "success");
    } catch (err) {
      setStatus("Could not send link. Try again.", "error");
    } finally {
      sending = false;
    }
  };
</script>

<form class="login-form" on:submit|preventDefault={handleSubmit}>
  <label class="field">
    <span>Email</span>
    <input
      type="email"
      name="email"
      placeholder="you@domain.com"
      autocomplete="email"
      bind:value={email}
      required
    />
  </label>
  <button class="cta" type="submit" disabled={sending}>
    {sending ? "Sending..." : "Send magic link"}
  </button>
</form>
<p class="hint">Invite-only. If you are not on the uploader list, no email will arrive.</p>
{#if error === "invalid"}
  <p class="status error">Link expired or already used. Request a new one.</p>
{/if}
{#if status}
  <p class={`status ${statusState === "error" ? "error" : ""} ${
    statusState === "success" ? "success" : ""
  }`}>
    {status}
  </p>
{/if}

<style>
  .login-form {
    display: grid;
    gap: 16px;
    max-width: 420px;
  }

  .field {
    display: grid;
    gap: 8px;
    font-weight: 600;
    color: var(--ink-muted);
  }

  .field input {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #fffdf9;
    font-size: 16px;
    color: var(--bg-ink);
  }

  .field input:focus {
    outline: 2px solid rgba(212, 90, 60, 0.3);
    border-color: var(--accent);
  }

  .hint {
    margin-top: 16px;
    color: var(--ink-muted);
    font-size: 14px;
  }

  .status {
    margin-top: 12px;
    font-weight: 600;
    color: var(--accent-strong);
  }

  .status.error {
    color: #8a2e1c;
  }

  .status.success {
    color: #2f6f3b;
  }
</style>

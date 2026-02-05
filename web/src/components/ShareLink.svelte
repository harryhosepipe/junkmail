<script>
  import { onDestroy } from "svelte";

  export let url = "";

  let status = "";
  let timer = null;

  const setStatus = (message) => {
    status = message;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      status = "";
    }, 2000);
  };

  const copyLink = async () => {
    if (!url) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setStatus("Copied link.");
        return;
      }
      setStatus("Copy not supported.");
    } catch (err) {
      setStatus("Copy failed.");
    }
  };

  onDestroy(() => {
    if (timer) clearTimeout(timer);
  });
</script>

<div class="share">
  <button class="share-button" type="button" on:click={copyLink}>Copy link</button>
  {#if status}
    <span class="share-status">{status}</span>
  {/if}
</div>

<style>
  .share {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .share-button {
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #fffdf9;
    font-weight: 600;
    cursor: pointer;
  }

  .share-status {
    font-size: 12px;
    color: var(--accent-strong);
  }
</style>

<script>
  import { onMount } from "svelte";
  import { createAuthSessionStore } from "../store";

  export let apiBaseUrl = "";
  export let initialUser = null;

  const profilePath = "/profile";
  const profileLabel = (user) => {
    const alias = user?.alias;
    const email = user?.email;
    if (alias) return `Junklord: ${alias}`;
    if (email) return `Junklord: ${email}`;
    return "Junklord";
  };

  let label =
    initialUser?.email || initialUser?.alias
      ? profileLabel(initialUser)
      : initialUser
        ? "Junklord"
        : "Visitor";
  let state = initialUser ? "authed" : "guest";
  let authStoreBaseUrl = "";
  let authStore = createAuthSessionStore(apiBaseUrl);

  const setIndicator = (text, nextState) => {
    label = text;
    state = nextState;
  };

  onMount(async () => {
    setIndicator("Visitor", "guest");
    try {
      const session = await authStore.loadSession();
      const user = session?.user;
      if (!user) {
        setIndicator("Visitor", "guest");
        return;
      }
      if (user?.email || user?.alias) {
        setIndicator(profileLabel(user), "authed");
      } else {
        setIndicator("Junklord", "authed");
      }
    } catch (err) {
      setIndicator("Visitor", "guest");
    }
  });

  $: if (apiBaseUrl !== authStoreBaseUrl) {
    authStore = createAuthSessionStore(apiBaseUrl);
    authStoreBaseUrl = apiBaseUrl;
  }
</script>

{#if state === "authed"}
  <a class="auth-indicator" data-state={state} href={profilePath}>{label}</a>
{:else}
  <div class="auth-indicator" data-state={state}>{label}</div>
{/if}

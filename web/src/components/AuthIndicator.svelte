<script>
  import { onMount } from "svelte";

  export let apiBaseUrl = "/api";
  export let initialUser = null;

  const profilePath = "/profile";
  const profileLabel = (user) => {
    const alias = user?.alias;
    const email = user?.email;
    if (alias) return `Junklord: ${alias}`;
    if (email) return `Junklord: ${email}`;
    return "Junklord";
  };

  let label = initialUser?.email || initialUser?.alias
    ? profileLabel(initialUser)
    : initialUser
      ? "Junklord"
      : "Visitor";
  let state = initialUser ? "authed" : "guest";

  const setIndicator = (text, nextState) => {
    label = text;
    state = nextState;
  };

  onMount(async () => {
    setIndicator("Visitor", "guest");
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
        credentials: "include",
      });
      if (!response.ok) {
        setIndicator("Visitor", "guest");
        return;
      }
      const data = await response.json();
      const user = data?.user;
      if (user?.email || user?.alias) {
        setIndicator(profileLabel(user), "authed");
      } else {
        setIndicator("Junklord", "authed");
      }
    } catch (err) {
      setIndicator("Visitor", "guest");
    }
  });
</script>

{#if state === "authed"}
  <a class="auth-indicator" data-state={state} href={profilePath}>{label}</a>
{:else}
  <div class="auth-indicator" data-state={state}>{label}</div>
{/if}

<script>
  import { onMount } from "svelte";

  export let apiBaseUrl = "http://localhost:8787";
  export let initialUser = null;

  let label = initialUser?.email ? `Junklord: ${initialUser.email}` : initialUser ? "Junklord" : "Visitor";
  let state = initialUser ? "authed" : "guest";

  const setIndicator = (text, nextState) => {
    label = text;
    state = nextState;
  };

  onMount(async () => {
    setIndicator("Visitor", "guest");
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
        credentials: "include"
      });
      if (!response.ok) {
        setIndicator("Visitor", "guest");
        return;
      }
      const data = await response.json();
      const email = data?.user?.email;
      if (email) {
        setIndicator(`Junklord: ${email}`, "authed");
      } else {
        setIndicator("Junklord", "authed");
      }
    } catch (err) {
      setIndicator("Visitor", "guest");
    }
  });
</script>

<div class="auth-indicator" data-state={state}>{label}</div>

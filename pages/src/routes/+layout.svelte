<script lang="ts">
  import '$styles/editorial.css';
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { isAuthenticated, clearToken } from '$lib/auth';
  import { goto } from '$app/navigation';

  let { children, data } = $props();
  let authed = $state(false);

  onMount(() => {
    authed = isAuthenticated();
  });

  // Re-read auth state on every client-side navigation so the nav links
  // reflect register/login/logout actions without a full page reload.
  afterNavigate(() => {
    authed = isAuthenticated();
  });

  function logout() {
    clearToken();
    authed = false;
    goto('/');
  }
</script>

<nav class="site-nav">
  <a class="brand" href="/">
    Phenologue<span class="vol">vol. 0.1</span>
  </a>
  <div class="links">
    <a href="/methodology">methodology</a>
    <a href="/about">about</a>
    {#if !data.maintenance}
      {#if authed}
        <a href="/dashboard">dashboard</a>
        <button type="button" class="logout" onclick={logout}>log out</button>
      {:else}
        <a href="/login">log in</a>
        <a href="/register">register</a>
      {/if}
    {:else}
      <span class="muted-tag">private beta</span>
    {/if}
  </div>
</nav>

<main class="page">
  {@render children()}
</main>

<footer class="site-foot">
  <div>
    Phenologue v0.1 · open methodology ·
    <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
  </div>
  <div class="meta">
    methodology v0.1 · api v0.1
  </div>
</footer>

<style>
  .logout {
    background: transparent;
    color: var(--ink);
    border: none;
    padding: 0;
    font-family: var(--mono);
    font-size: 0.85rem;
    text-transform: lowercase;
    letter-spacing: 0;
    cursor: pointer;
  }
  .logout:hover { color: var(--accent); background: transparent; }

  .muted-tag {
    font-family: var(--mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
    border: 1px solid var(--accent);
    padding: 0.15rem 0.5rem;
    border-radius: 2px;
  }

  .site-foot {
    border-top: 1px solid var(--rule);
    padding: 1.5rem;
    background: var(--paper-deep);
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    font-family: var(--mono);
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
</style>

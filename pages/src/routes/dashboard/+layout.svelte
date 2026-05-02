<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isAuthenticated } from '$lib/auth';
  import { page } from '$app/stores';

  let ready = $state(false);

  onMount(() => {
    if (!isAuthenticated()) {
      goto('/login');
      return;
    }
    ready = true;
  });

  let { children } = $props();
</script>

{#if ready}
  <div class="dashboard">
    <aside class="rail">
      <h4>Console</h4>
      <nav>
        <a href="/dashboard" class:active={$page.url.pathname === '/dashboard'}>Overview</a>
        <a href="/dashboard/sessions" class:active={$page.url.pathname.startsWith('/dashboard/sessions') && !$page.url.pathname.includes('/new')}>Sessions</a>
        <a href="/dashboard/cultivars" class:active={$page.url.pathname.startsWith('/dashboard/cultivars') || $page.url.pathname.startsWith('/dashboard/batches')}>Cultivars</a>
      </nav>
      <a class="primary-cta" href="/dashboard/quick-log">⚡ Quick log</a>
      <a class="secondary-cta" href="/dashboard/sessions/new">+ Guided session</a>
    </aside>
    <div class="content">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .dashboard {
    display: grid;
    grid-template-columns: 14rem 1fr;
    gap: 2rem;
  }

  .rail {
    border-right: 1px solid var(--rule);
    padding-right: 1.5rem;
  }

  .rail h4 { margin-bottom: 1rem; }

  .rail nav {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .rail nav a {
    display: block;
    padding: 0.4rem 0.6rem;
    font-family: var(--mono);
    font-size: 0.85rem;
    text-transform: lowercase;
    color: var(--ink);
    border-bottom: none;
    border-left: 3px solid transparent;
  }
  .rail nav a:hover { background: var(--paper-deep); }
  .rail nav a.active {
    border-left-color: var(--accent);
    background: var(--paper-deep);
    color: var(--ink);
  }

  .primary-cta {
    display: block;
    padding: 0.55rem 0.7rem;
    background: var(--ink);
    color: var(--paper);
    font-family: var(--mono);
    font-size: 0.82rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
    border-bottom: none;
    margin-bottom: 0.4rem;
  }
  .primary-cta:hover { background: var(--accent); color: var(--paper); }

  .secondary-cta {
    display: block;
    padding: 0.45rem 0.7rem;
    background: transparent;
    color: var(--ink);
    border: 1px solid var(--ink);
    font-family: var(--mono);
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
    border-bottom: 1px solid var(--ink);
  }
  .secondary-cta:hover { background: var(--paper-deep); color: var(--ink); }

  @media (max-width: 760px) {
    .dashboard { grid-template-columns: 1fr; }
    .rail { border-right: none; border-bottom: 1px solid var(--rule); padding-bottom: 1rem; padding-right: 0; }
  }
</style>

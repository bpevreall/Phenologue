<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import { setToken } from '$lib/auth';
  import { goto } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      const result = await api<{ token: string; patient_id: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(result.token, result.patient_id);
      goto('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        error = err.errors[0]?.message ?? 'Login failed';
      } else {
        error = 'Network error';
      }
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Log in — Phenologue</title></svelte:head>

<section class="column auth">
  <h4>Volume 0.1</h4>
  <h1>Log in</h1>
  <p>Patient login. No-PII pseudonymous accounts; your real name is yours alone.</p>

  <form onsubmit={submit}>
    {#if error}
      <div class="form-error">{error}</div>
    {/if}

    <div class="form-row">
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required autocomplete="email" />
    </div>

    <div class="form-row">
      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} required autocomplete="current-password" />
    </div>

    <button type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
  </form>

  <p class="meta">
    No account? <a href="/register">Register</a>. Passkey support arrives in v0.2.
  </p>
</section>

<style>
  .auth { padding-top: 2rem; }
  form { margin-top: 1.5rem; }
</style>

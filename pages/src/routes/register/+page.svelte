<script lang="ts">
  import { api, ApiError } from '$lib/api';
  import { setToken } from '$lib/auth';
  import { goto } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let pseudonym = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (password.length < 12) {
      error = 'Password must be at least 12 characters.';
      return;
    }

    busy = true;
    error = null;
    try {
      // Stream C security hardening: /auth/register intentionally returns a
      // generic 200 regardless of whether the email is new or already
      // registered (account-enumeration mitigation). It does NOT return a
      // token. We follow up with /auth/login to obtain credentials. If the
      // email was already registered, login will fail with invalid_credentials
      // and the user sees a helpful error.
      await api<{ ok: true }>('/auth/register', {
        method: 'POST',
        body: { email, password, pseudonym: pseudonym || undefined },
      });
      const session = await api<{ token: string; patient_id: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(session.token, session.patient_id);
      goto('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.errors[0]?.code;
        if (code === 'invalid_credentials') {
          // Login failed after the generic register success — almost certainly
          // means the email was already registered with a different password.
          error = 'That email is already registered. Try logging in instead.';
        } else {
          error = err.errors[0]?.message ?? 'Registration failed';
        }
      } else {
        error = 'Network error';
      }
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Register — Phenologue</title></svelte:head>

<section class="column auth">
  <h4>Volume 0.1</h4>
  <h1>Register</h1>
  <p>
    A pseudonymous account is created. The only required PII is an email
    address (used for password reset). Real name, date of birth, and
    geographic data are all optional and live in a separate table from
    your session data.
  </p>

  <form onsubmit={submit}>
    {#if error}<div class="form-error">{error}</div>{/if}

    <div class="form-row">
      <label for="email">Email <span class="meta">(required, used for password reset)</span></label>
      <input id="email" type="email" bind:value={email} required autocomplete="email" />
    </div>

    <div class="form-row">
      <label for="password">Password <span class="meta">(min 12 characters)</span></label>
      <input id="password" type="password" bind:value={password} minlength="12" required autocomplete="new-password" />
    </div>

    <div class="form-row">
      <label for="pseudonym">Pseudonym <span class="meta">(optional, displayed nowhere public yet)</span></label>
      <input id="pseudonym" type="text" bind:value={pseudonym} autocomplete="off" />
    </div>

    <button type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
  </form>

  <p class="meta">By registering you agree to the <a href="/methodology">methodology</a> and <a href="/about">data principles</a>.</p>
</section>

<style>
  .auth { padding-top: 2rem; }
  form { margin-top: 1.5rem; }
</style>

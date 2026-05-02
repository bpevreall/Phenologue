<script lang="ts">
  interface Props {
    text: string;
  }

  let { text }: Props = $props();
  let first = $derived(text.charAt(0));
  let rest = $derived(text.slice(1));
</script>

<p class="drop">
  <span class="cap">{first}</span>{rest}
</p>

<style>
  .drop {
    font-size: 1.05rem;
    line-height: 1.6;
  }

  .cap {
    float: left;
    font-family: var(--serif);
    font-weight: 600;
    font-size: 4.6rem;
    line-height: 0.85;
    margin: 0.4rem 0.4rem 0 0;
    color: var(--ink);
    font-feature-settings: 'lnum' 1;
  }
</style>

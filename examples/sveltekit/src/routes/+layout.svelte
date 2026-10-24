<script lang="ts">
  let { children } = $props();
</script>

<nav><a href="/">Etusivu</a> · <a href="/evasteet">Evästeet</a></nav>
<main>{@render children()}</main>
<footer><button type="button" data-keksi-open>Evästeasetukset</button></footer>

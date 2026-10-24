<script lang="ts">
  let { data } = $props();
</script>

<svelte:head><title>Evästeet</title></svelte:head>

<h1>Evästekäytäntö</h1>
{@html data.table}

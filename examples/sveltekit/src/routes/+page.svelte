<svelte:head><title>Esimerkki</title></svelte:head>

<h1>Esimerkki Oy</h1>
<p>Sivusto, jossa on Google Analytics, Google Ads, Meta Pixel ja YouTube-video.</p>
<keksi-youtube video="aqz-KE-bpKQ" label="Big Buck Bunny"></keksi-youtube>
<button type="button" onclick={() => window.gtag?.('event', 'generate_lead')}>Lähetä yhteydenotto</button>

<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>RSVP Speed Reader</title>
</svelte:head>

{@render children()}

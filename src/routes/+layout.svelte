<script lang="ts">
	import '../app.css';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>QuickReader - Speed Read Any Book</title>
</svelte:head>

{@render children()}
<Footer />

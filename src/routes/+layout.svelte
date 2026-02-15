<script lang="ts">
	import { Info } from "lucide-svelte";
	import Login from "$lib/components/Login.svelte";
	import AboutModal from "$lib/components/AboutModal.svelte";
	import { initAuth } from "$lib/auth";
	import { onMount } from "svelte";

	let { children } = $props();
	let showAbout = $state(false);

	onMount(() => {
		initAuth();
	});
</script>

<AboutModal isOpen={showAbout} close={() => (showAbout = false)} />

<header class="header">
	<a href="/" class="title">Bluemin'</a>

	<div class="right-section">
		<button
			class="info-btn"
			onclick={() => (showAbout = true)}
			aria-label="About"
		>
			<Info size={20} />
		</button>
		<Login />
	</div>
</header>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: "Inter", "Outfit", "Helvetica Neue", Arial, sans-serif;
		background-color: #0f172a;
		color: white;
		overflow-x: hidden;
	}

	.header {
		height: 64px;
		background: rgba(30, 41, 59, 0.7);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		justify-content: space-between; /* Changed to space-between */
		padding: 0 20px;
		color: white;
		position: sticky;
		top: 0;
		z-index: 100;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	@media (max-width: 640px) {
		.header {
			height: 56px;
			padding: 0 16px;
		}
	}

	.title {
		font-weight: 800;
		font-size: 1.4rem;
		letter-spacing: -1px;
		background: linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		white-space: nowrap;
		text-decoration: none;
	}

	@media (max-width: 640px) {
		.title {
			font-size: 1.2rem;
		}
	}

	.right-section {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.info-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 8px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.info-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: white;
	}

	main {
		min-height: calc(100vh - 64px);
	}
</style>

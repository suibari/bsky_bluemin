<script lang="ts">
	import { goto } from "$app/navigation";
	import { Search, Info } from "lucide-svelte";
	import Login from "$lib/components/Login.svelte";
	import AboutModal from "$lib/components/AboutModal.svelte";
	import { initAuth } from "$lib/auth";
	import { onMount } from "svelte";

	let { children } = $props();
	let searchTerm = $state("");
	let showAbout = $state(false);

	function handleSearch(e: SubmitEvent) {
		e.preventDefault();
		if (searchTerm.trim()) {
			goto(`/${searchTerm.trim()}`);
			searchTerm = "";
		}
	}

	onMount(() => {
		initAuth();
	});
</script>

<AboutModal isOpen={showAbout} close={() => (showAbout = false)} />

<header class="header">
	<form class="search-box" onsubmit={handleSearch}>
		<Search size={18} class="search-icon" />
		<input type="text" placeholder="Search handle..." bind:value={searchTerm} />
	</form>
	<Login />

	<div class="right-section">
		<button
			class="info-btn"
			onclick={() => (showAbout = true)}
			aria-label="About"
		>
			<Info size={20} />
		</button>
		<div class="title">Bluemin'</div>
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
		/* justify-content: space-between; Removed to keep items on left */
		padding: 0 16px;
		color: white;
		position: sticky;
		top: 0;
		z-index: 100;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		gap: 12px;
	}

	@media (max-width: 640px) {
		.header {
			height: 56px;
			padding: 0 12px;
			gap: 8px;
		}
	}

	.search-box {
		display: flex;
		align-items: center;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		padding: 6px 16px;
		width: 240px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.search-box:focus-within {
		width: 320px;
		background: rgba(255, 255, 255, 0.1);
		border-color: #3b82f6;
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
	}

	@media (max-width: 640px) {
		.search-box {
			padding: 6px 12px;
			width: 120px;
		}
		.search-box:focus-within {
			width: 100%;
			position: absolute;
			left: 12px;
			right: 12px;
			z-index: 10;
			background: #1e293b;
		}
	}

	:global(.search-icon) {
		margin-right: 8px;
		color: #94a3b8;
	}

	input {
		background: transparent;
		border: none;
		color: white;
		outline: none;
		width: 100%;
		font-size: 0.95rem;
	}

	input::placeholder {
		color: #64748b;
	}

	.right-section {
		display: flex;
		align-items: center;
		margin-left: auto;
		gap: 8px;
	}

	.info-btn {
		background: transparent;
		border: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 6px;
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

	.title {
		font-weight: 800;
		font-size: 1.4rem;
		letter-spacing: -1px;
		background: linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		white-space: nowrap; /* Prevent wrapping */
	}

	@media (max-width: 640px) {
		.title {
			font-size: 1.1rem; /* Smaller font on mobile */
		}
	}

	main {
		min-height: calc(100vh - 64px);
	}
</style>

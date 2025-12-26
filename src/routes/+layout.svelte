<script lang="ts">
	import { goto } from "$app/navigation";
	import { Search } from "lucide-svelte";

	let { children } = $props();
	let searchTerm = $state("");

	function handleSearch(e: KeyboardEvent) {
		if (e.key === "Enter" && searchTerm.trim()) {
			goto(`/${searchTerm.trim()}`);
			searchTerm = "";
		}
	}
</script>

<header class="header">
	<div class="search-box">
		<Search size={18} class="search-icon" />
		<input
			type="text"
			placeholder="Search handle..."
			bind:value={searchTerm}
			onkeydown={handleSearch}
		/>
	</div>
	<div class="title">Bluemin'</div>
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
		padding: 0 12px;
		color: white;
		position: sticky;
		top: 0;
		z-index: 100;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	@media (max-width: 640px) {
		.header {
			height: 56px;
			padding: 0 12px;
		}
	}

	.search-box {
		display: flex;
		align-items: center;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		padding: 6px 16px;
		width: 200px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.search-box:focus-within {
		width: 300px;
		background: rgba(255, 255, 255, 0.1);
		border-color: #3b82f6;
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
	}

	@media (max-width: 640px) {
		.search-box {
			width: 140px;
		}
		.search-box:focus-within {
			width: 180px;
		}
	}

	:global(.search-icon) {
		margin-right: 10px;
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

	.title {
		margin-left: auto;
		font-weight: 800;
		font-size: 1.4rem;
		letter-spacing: -1px;
		background: linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	main {
		min-height: calc(100vh - 64px);
	}
</style>

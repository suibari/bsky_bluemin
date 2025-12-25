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
			placeholder="Handle or DID"
			bind:value={searchTerm}
			onkeydown={handleSearch}
		/>
	</div>
	<div class="title">Bluemin'</div>
</header>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN",
			"Hiragino Sans", Meiryo, sans-serif;
		background-color: #7494c0;
	}

	.header {
		height: 60px;
		background-color: #2c3e50;
		display: flex;
		align-items: center;
		padding: 0 16px;
		color: white;
		position: sticky;
		top: 0;
		z-index: 100;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.search-box {
		display: flex;
		align-items: center;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 20px;
		padding: 4px 12px;
		width: 200px;
		transition: width 0.3s;
	}

	.search-box:focus-within {
		width: 250px;
		background: rgba(255, 255, 255, 0.2);
	}

	:global(.search-icon) {
		margin-right: 8px;
		color: #ccc;
	}

	input {
		background: transparent;
		border: none;
		color: white;
		outline: none;
		width: 100%;
		font-size: 0.9rem;
	}

	input::placeholder {
		color: #888;
	}

	.title {
		margin-left: auto;
		font-weight: bold;
		font-size: 1.2rem;
		letter-spacing: 1px;
	}
</style>

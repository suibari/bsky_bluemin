<script lang="ts">
  import { onMount } from "svelte";

  onMount(() => {
    // Redirect to a default view or show instructions
  });
</script>

<div class="welcome">
  <h1>Welcome to Bluemin</h1>
  <p>
    Enter a Bluesky handle or DID in the top-left box to view real-time
    interactions from their followees.
  </p>
  <div class="example">
    <p>Try: <code>jay.bsky.team</code></p>
  </div>
</div>

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: calc(100vh - 60px);
    color: white;
    text-align: center;
    padding: 20px;
  }

  h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  p {
    font-size: 1.1rem;
    max-width: 500px;
    line-height: 1.6;
    opacity: 0.9;
  }

  .example {
    margin-top: 2rem;
    background: rgba(255, 255, 255, 0.1);
    padding: 1rem 2rem;
    border-radius: 12px;
  }

  code {
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }
</style>

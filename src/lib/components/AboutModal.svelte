<script lang="ts">
  import { X } from "lucide-svelte";

  export let isOpen = false;
  export let close: () => void; // Explicitly typed close prop

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" on:click={close}>
    <div
      class="modal-content"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="modal-header">
        <h2>About Bluemin'</h2>
        <button class="close-btn" on:click={close} aria-label="Close modal">
          <X size={20} />
        </button>
      </div>
      <div class="modal-body">
        <p>
          This tool visualizes real-time interactions of a user's followees on
          Bluesky.
        </p>
        <p>
          If the number of followees exceeds the limit, a random selection will
          generally receive updates.
        </p>
        <p>
          By default, users with the <code>!no-unauthenticated</code> label are
          hidden.
          <strong>Sign in</strong> to view all users.
        </p>

        <div class="links">
          <p>
            Developer: <a
              href="https://bsky.app/profile/suibari.com"
              target="_blank"
              rel="noopener noreferrer">Suibari</a
            >
          </p>
          <p>
            Code: <a
              href="https://github.com/suibari/bsky_bluemin/tree/main"
              target="_blank"
              rel="noopener noreferrer">GitHub</a
            >
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .modal-content {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    padding: 24px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.3),
      0 10px 10px -5px rgba(0, 0, 0, 0.2);
    animation: modalPop 0.2s ease-out;
    color: #cbd5e1;
    line-height: 1.6;
  }

  @keyframes modalPop {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 12px;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
  }

  .close-btn {
    background: transparent;
    padding: 8px;
    color: #94a3b8;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-size: 1rem;
  }

  p {
    margin: 0;
  }

  code {
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    color: #fca5a5;
  }

  .links {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  a {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
  }

  a:hover {
    text-decoration: underline;
    color: #60a5fa;
  }
</style>

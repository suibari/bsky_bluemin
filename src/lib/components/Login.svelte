<script lang="ts">
  import { authState, signIn, signOut } from "../auth";
  import { X } from "lucide-svelte";

  let handle = "";
  let showModal = false;

  async function handleSignIn() {
    if (!handle) return;
    await signIn(handle);
    showModal = false;
    handle = "";
  }

  function openModal() {
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    handle = "";
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  // Reactively update local variables when store changes
  $: ({ isAuthenticated, user, loading } = $authState);
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="auth-container">
  {#if $authState.loading}
    <span class="loading">Loading...</span>
  {:else if $authState.isAuthenticated}
    <div class="user-info">
      <button on:click={signOut} class="btn-signout" title="Sign Out"
        >Sign Out</button
      >
    </div>
  {:else}
    <button on:click={openModal} class="btn-signin">Sign In</button>
  {/if}
</div>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" on:click={closeModal}>
    <div
      class="modal-content"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="modal-header">
        <h2>Sign In with Bluesky</h2>
        <button
          class="close-btn"
          on:click={closeModal}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
      </div>
      <div class="modal-body">
        <p class="description">Enter your Bluesky handle to sign in.</p>
        <div class="input-group">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            bind:value={handle}
            placeholder="handle.bsky.social"
            on:keydown={(e) => e.key === "Enter" && handleSignIn()}
            autofocus
          />
        </div>
        <button on:click={handleSignIn} class="btn-submit" disabled={!handle}>
          Sign In
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .auth-container {
    display: flex;
    align-items: center;
    /* margin-left: 1rem;  Removed to allow parent to control spacing */
  }

  .user-info {
    display: flex;
    gap: 1rem;
    align-items: center;
    font-size: 0.9rem;
    color: #cbd5e1;
  }

  button {
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.4rem 1rem;
    border-radius: 9999px;
    border: none;
    transition: all 0.2s;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-signin {
    background: #3b82f6;
    color: white;
  }

  .btn-signin:hover {
    background: #2563eb;
  }

  .btn-signout {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }

  .btn-signout:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .loading {
    opacity: 0.7;
    font-size: 0.875rem;
  }

  /* Modal Styles */
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
    max-width: 400px;
    padding: 24px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.3),
      0 10px 10px -5px rgba(0, 0, 0, 0.2);
    animation: modalPop 0.2s ease-out;
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
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
  }

  .close-btn {
    background: transparent;
    padding: 8px;
    color: #94a3b8;
    border-radius: 50%;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .description {
    margin: 0;
    color: #94a3b8;
    font-size: 0.95rem;
  }

  .input-group {
    width: 100%;
  }

  input {
    width: 100%;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 12px 16px;
    color: white;
    font-size: 1rem;
    outline: none;
    transition: all 0.2s;
    box-sizing: border-box; /* Fix width overlap */
  }

  input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .btn-submit {
    width: 100%;
    padding: 12px;
    background: #3b82f6;
    color: white;
    font-size: 1rem;
    margin-top: 8px;
  }

  .btn-submit:hover:not(:disabled) {
    background: #2563eb;
  }
</style>

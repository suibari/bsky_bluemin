<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import { Heart, Repeat, UserPlus, MessageSquare } from "lucide-svelte";
  import { fade, scale, fly } from "svelte/transition";

  interface InteractionEvent {
    type: string;
    text: string;
    image?: string;
    timestamp: string;
    id: string;
    url?: string;
  }

  let {
    did,
    avatar,
    displayName,
    event,
    x,
    y,
    sizeFactor = 1,
  } = $props<{
    did: string;
    avatar?: string;
    displayName: string;
    event?: InteractionEvent;
    x: number;
    y: number;
    sizeFactor?: number;
  }>();

  let activeBubbles = $state<InteractionEvent[]>([]);
  let processedEventIds = new Set<string>();

  // Image loading with retry
  let imageAttempts = $state(0);
  let imageVisible = $state(true);
  let retryTimer: any;

  const icons = {
    post: MessageSquare,
    like: Heart,
    repost: Repeat,
    follow: UserPlus,
  };

  $effect(() => {
    if (event && !processedEventIds.has(event.id)) {
      untrack(() => {
        processedEventIds.add(event.id);
        addBubble(event);
      });
    }
  });

  function addBubble(ev: InteractionEvent) {
    if (activeBubbles.some((b) => b.id === ev.id)) return;
    activeBubbles = [...activeBubbles, ev];
    setTimeout(() => {
      activeBubbles = activeBubbles.filter((b) => b.id !== ev.id);
    }, 4000);
  }

  function handleImageError() {
    if (imageAttempts < 5) {
      imageVisible = false;
      const delay = Math.pow(2, imageAttempts) * 1000 + Math.random() * 1000;
      imageAttempts++;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        imageVisible = true;
      }, delay);
    }
  }

  onDestroy(() => {
    if (retryTimer) clearTimeout(retryTimer);
  });

  let avatarSize = $derived(48 * sizeFactor);
</script>

<div
  class="node-container"
  style="--node-size: {avatarSize}px; left: {x}px; top: {y}px; z-index: {activeBubbles.length >
  0
    ? 100
    : 1};"
>
  <a
    href="https://bsky.app/profile/{did}"
    target="_blank"
    rel="noopener noreferrer"
    class="avatar-link"
  >
    {#if avatar && imageVisible}
      <img
        src={avatar}
        alt={displayName}
        class="avatar"
        onerror={handleImageError}
      />
    {:else}
      <div class="avatar-placeholder">{displayName[0]}</div>
    {/if}
  </a>

  <div class="bubbles-container">
    {#each activeBubbles as bubble (bubble.id)}
      <a
        href={bubble.url}
        target="_blank"
        rel="noopener noreferrer"
        class="bubble-link"
        transition:fly={{ y: -20, duration: 400 }}
      >
        <div class="bubble-popup">
          <div class="bubble-content">
            <div class="bubble-header">
              {#if icons[bubble.type as keyof typeof icons]}
                {@const Icon = icons[bubble.type as keyof typeof icons]}
                <Icon size={10} />
              {/if}
              <span>{bubble.type}</span>
            </div>
            <div class="bubble-text">{bubble.text}</div>
          </div>
        </div>
      </a>
    {/each}
  </div>
</div>

<style>
  .node-container {
    position: absolute;
    width: var(--node-size);
    height: var(--node-size);
    aspect-ratio: 1 / 1;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      width 0.5s ease,
      height 0.5s ease,
      left 0.8s cubic-bezier(0.4, 0, 0.2, 1),
      top 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translate(-50%, -50%);
  }

  .avatar-link {
    width: 100%;
    height: 100%;
    display: block;
    text-decoration: none;
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: calc(var(--node-size) / 2.5);
    border: 2px solid white;
  }

  .bubbles-container {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 150px;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    pointer-events: none;
    z-index: 10;
  }

  .bubble-link {
    text-decoration: none;
    pointer-events: auto;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .bubble-popup {
    background: white;
    border-radius: 12px;
    padding: 6px 10px;
    margin-bottom: 4px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.05);
    max-width: 100%;
    transition: transform 0.2s ease;
  }

  .bubble-link:hover .bubble-popup {
    transform: scale(1.05);
    background: #f8fafc;
  }

  .bubble-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .bubble-header {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.6rem;
    font-weight: bold;
    color: #888;
    text-transform: uppercase;
  }

  .bubble-text {
    font-size: 0.75rem;
    color: #333;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>

<script lang="ts">
  import { Heart, Repeat, UserPlus, MessageSquare } from "lucide-svelte";

  let { event } = $props<{
    event: {
      type: string;
      author: string;
      avatar?: string;
      displayName: string;
      text: string;
      timestamp: string;
    };
  }>();

  const colors = {
    post: "#ffffff",
    like: "#ffebee",
    repost: "#e8f5e9",
    follow: "#e3f2fd",
  };

  const icons = {
    post: MessageSquare,
    like: Heart,
    repost: Repeat,
    follow: UserPlus,
  };

  let bgColor = $derived(colors[event.type as keyof typeof colors] || "#fff");
  let Icon = $derived(icons[event.type as keyof typeof icons] || MessageSquare);
</script>

<div class="bubble-wrapper">
  <div class="avatar-container">
    {#if event.avatar}
      <img src={event.avatar} alt={event.displayName} class="avatar" />
    {:else}
      <div class="avatar-placeholder">{event.displayName[0]}</div>
    {/if}
  </div>

  <div class="content-container">
    <div class="display-name">{event.displayName}</div>
    <div class="bubble" style="background-color: {bgColor}">
      <div class="type-badge">
        <Icon size={12} strokeWidth={3} />
        <span>{event.type.toUpperCase()}</span>
      </div>
      <div class="text">{event.text}</div>
      <div class="timestamp">{event.timestamp}</div>
    </div>
  </div>
</div>

<style>
  .bubble-wrapper {
    display: flex;
    gap: 8px;
    max-width: 85%;
    align-self: flex-start;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .avatar-container {
    flex-shrink: 0;
    margin-top: 4px;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #95a5a6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
  }

  .content-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .display-name {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.9);
    margin-left: 4px;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
  }

  .bubble {
    padding: 8px 12px;
    border-radius: 16px;
    border-top-left-radius: 4px;
    position: relative;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    color: #333;
  }

  .bubble::before {
    content: "";
    position: absolute;
    left: -8px;
    top: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 10px 10px 0;
    border-color: transparent white transparent transparent;
    /* This color should match the bubble background, but white is default */
  }

  /* Specific bubble tip colors */
  .bubble-wrapper :global(.bubble::before) {
    border-right-color: inherit;
  }

  .type-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.6rem;
    font-weight: 900;
    margin-bottom: 4px;
    opacity: 0.6;
  }

  .text {
    font-size: 0.95rem;
    line-height: 1.4;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .timestamp {
    font-size: 0.65rem;
    color: #999;
    text-align: right;
    margin-top: 4px;
  }
</style>

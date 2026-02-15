<script lang="ts">
  import { onMount, onDestroy, untrack, tick } from "svelte";
  import { fade } from "svelte/transition";
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { AtpAgent } from "@atproto/api";
  import { Jetstream, type CommitEvent } from "@skyware/jetstream";
  import BubbleGalaxy from "$lib/components/BubbleGalaxy.svelte";
  import { authState } from "$lib/auth";
  import * as d3 from "d3";

  let id = $derived(page.params.id);
  // Default public agent
  const publicAgent = new AtpAgent({ service: "https://public.api.bsky.app" });
  // Use authenticated agent if available, otherwise public
  let agent = $derived($authState.agent || publicAgent);

  interface InteractionEvent {
    type: string;
    uri: string;
    author: string;
    authorAvatar?: string;
    authorDisplayName: string;
    text: string;
    image?: string;
    timestamp: string;
    id: string;
    url?: string;
  }

  interface Node extends d3.SimulationNodeDatum {
    did: string;
    avatar?: string;
    displayName: string;
    interactionCount: number;
    sizeFactor: number;
    radius: number;
    hasInteracted: boolean;
  }

  let latestEvents = $state<Map<string, InteractionEvent>>(new Map());
  let nodes = $state<Node[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let jetstream: Jetstream | null = null;

  let galaxyComponent = $state<BubbleGalaxy>();

  let backgroundImage = $state<string | null>(null);
  let backgroundImageKey = $state<number>(0);
  let backgroundImageAuthor = $state<string | null>(null);
  let backgroundImageAuthorDid = $state<string | null>(null);

  const MAX_FOLLOWEES = 256;
  const SAMPLE_POOL_SIZE = 2000;
  const BASE_RADIUS = 24;
  let innerWidth = $state(browser ? window.innerWidth : 1200);
  let isMobile = $derived(innerWidth < 640);

  async function resolveId(identifier: string) {
    try {
      if (identifier.startsWith("did:")) return identifier;
      const res = await agent.resolveHandle({ handle: identifier });
      return res.data.did;
    } catch (e) {
      console.error(e);
      throw new Error(`Could not resolve handle: ${identifier}`);
    }
  }

  async function fetchFollows(did: string) {
    try {
      loading = true;
      let cursor: string | undefined;
      const allFollows: any[] = [];

      do {
        const res = await agent.getFollows({
          actor: did,
          cursor,
          limit: 100,
        });

        // Filter out users with !no-unauthenticated label IF not authenticated
        const filteredFollows = res.data.follows.filter(
          (profile: any) =>
            $authState.isAuthenticated || // If authenticated, show everything (or let user preference handle it, but requirement says "do not exclude")
            profile.labels == null ||
            !profile.labels.some(
              (label: any) => label.val === "!no-unauthenticated",
            ),
        );

        const batch = filteredFollows.map((f: any) => {
          // Random circular positioning for dense packing
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 300;

          return {
            did: f.did,
            avatar: f.avatar,
            displayName: f.displayName || f.handle,
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle),
            interactionCount: 0,
            sizeFactor: 1,
            radius: BASE_RADIUS,
            hasInteracted: false,
          };
        });

        allFollows.push(...batch);
        cursor = res.data.cursor;

        if (allFollows.length >= SAMPLE_POOL_SIZE) {
          cursor = undefined;
        }
      } while (cursor);

      // Randomly select MAX_FOLLOWEES if pool is larger
      let selectedFollows = allFollows;
      if (allFollows.length > MAX_FOLLOWEES) {
        selectedFollows = allFollows
          .sort(() => Math.random() - 0.5)
          .slice(0, MAX_FOLLOWEES);
      }

      nodes = selectedFollows;
    } catch (e) {
      console.error(e);
      error = "Failed to fetch follows.";
    } finally {
      loading = false;
    }
  }

  function cleanup() {
    if (jetstream) {
      jetstream.close();
      jetstream = null;
    }
  }

  $effect(() => {
    // Reactively track id
    const targetId = id;

    // Reset state for new ID
    nodes = [];
    loading = true;
    error = null;
    latestEvents = new Map();
    cleanup();

    const init = async () => {
      try {
        const targetDid = await resolveId(targetId || "");
        await fetchFollows(targetDid);
        loading = false;
        await tick();

        if (browser && nodes.length > 0) {
          jetstream = new Jetstream({
            wantedCollections: [
              "app.bsky.feed.post",
              "app.bsky.feed.like",
              "app.bsky.feed.repost",
              "app.bsky.graph.follow",
            ],
            wantedDids: nodes.map((n) => n.did),
          });

          jetstream.on("commit", (event: CommitEvent<any>) => {
            if (event.commit.operation === "create") {
              handleEvent(event);
            }
          });

          jetstream.start();
        }
      } catch (e: any) {
        error = e.message;
        loading = false;
      }
    };

    init();

    return () => {
      cleanup();
    };
  });

  async function handleEvent(event: CommitEvent<any>) {
    const did = event.did;
    const authorNode = nodes.find((n) => n.did === did);
    if (!authorNode) return;

    const commit = event.commit as any;
    const record = commit.record;
    let type = "";
    let text = "";
    let url = "";

    const rkey = commit.rkey;
    const authorDid = event.did;

    switch (commit.collection) {
      case "app.bsky.feed.post":
        type = "post";
        text = record.text || "";
        url = `https://bsky.app/profile/${authorDid}/post/${rkey}`;

        // Check for images in the post itself
        // Since we need valid image URLs (not blob refs), we fetch the post view
        // to get the hydrated data.
        if (
          record.embed &&
          (record.embed.$type === "app.bsky.embed.images" ||
            record.embed.$type === "app.bsky.embed.recordWithMedia")
        ) {
          try {
            const postUri = `at://${authorDid}/app.bsky.feed.post/${rkey}`;
            const res = await agent.getPosts({ uris: [postUri] });
            if (res.data.posts.length > 0) {
              const postView = res.data.posts[0];
              const img = extractImageFromPostView(postView.embed);
              if (img) {
                backgroundImage = img;
                backgroundImageKey++;
                backgroundImageAuthor =
                  postView.author.displayName || postView.author.handle;
                backgroundImageAuthorDid = postView.author.did;
              }
            }
          } catch (e) {
            console.error("Failed to fetch post for image", e);
          }
        }
        break;
      case "app.bsky.feed.like":
      case "app.bsky.feed.repost":
        type = commit.collection === "app.bsky.feed.like" ? "like" : "repost";
        text = type === "like" ? "Liked a post" : "Reposted a post";
        if (record.subject?.uri) {
          const uri = record.subject.uri;
          const parts = uri.replace("at://", "").split("/");
          if (parts.length >= 3) {
            url = `https://bsky.app/profile/${parts[0]}/post/${parts[2]}`;

            // Fetch interaction target to get image
            try {
              const res = await agent.getPosts({ uris: [uri] });
              if (res.data.posts.length > 0) {
                const postView = res.data.posts[0];
                // Look for image in the target post
                const img = extractImageFromPostView(postView.embed);
                if (img) {
                  backgroundImage = img;
                  backgroundImageKey++;
                  backgroundImageAuthor =
                    postView.author.displayName || postView.author.handle;
                  backgroundImageAuthorDid = postView.author.did;
                }
              }
            } catch (e) {
              console.error("Failed to fetch interaction target", e);
            }
          }
        }
        break;
      case "app.bsky.graph.follow":
        type = "follow";
        text = "Followed someone";
        if (record.subject) {
          url = `https://bsky.app/profile/${record.subject}`;
        }
        break;
    }

    if (type) {
      console.log(`Interaction detected for ${did}: ${type}`);
      authorNode.interactionCount += 1;
      authorNode.sizeFactor = 1 + Math.log10(authorNode.interactionCount + 1);
      authorNode.radius = BASE_RADIUS * authorNode.sizeFactor;
      authorNode.hasInteracted = true;

      nodes = [...nodes]; // Explicitly trigger reactivity

      if (galaxyComponent) {
        galaxyComponent.notifyInteraction();
      }

      const newEvent: InteractionEvent = {
        type,
        uri: commit.rev,
        author: did,
        authorAvatar: authorNode.avatar,
        authorDisplayName: authorNode.displayName,
        text,
        timestamp: new Date().toLocaleTimeString(),
        id: Math.random().toString(36).substring(7),
        url,
      };

      latestEvents.set(did, newEvent);
      latestEvents = new Map(latestEvents);
    }
  }

  function extractImageFromPostView(embed: any): string | null {
    if (!embed) return null;

    // Images embed
    if (embed.$type === "app.bsky.embed.images#view" && embed.images?.length) {
      return embed.images[0].fullsize || embed.images[0].thumb;
    }

    // Record with media
    if (embed.$type === "app.bsky.embed.recordWithMedia#view" && embed.media) {
      return extractImageFromPostView(embed.media);
    }

    // External embed (card)
    if (
      embed.$type === "app.bsky.embed.external#view" &&
      embed.external?.thumb
    ) {
      return embed.external.thumb;
    }

    return null;
  }
</script>

<svelte:window bind:innerWidth />

<div class="page-container">
  {#if loading}
    <div class="status-overlay">
      <div class="spinner"></div>
      <p>Gathering {id} circle...</p>
    </div>
  {:else if error}
    <div class="status-overlay">
      <p class="error">{error}</p>
    </div>
  {:else}
    {#key backgroundImageKey}
      {#if backgroundImage}
        <div class="bg-image-container" transition:fade={{ duration: 1000 }}>
          <img src={backgroundImage} alt="" class="bg-image" />
          <div class="bg-overlay"></div>
        </div>
      {/if}
    {/key}

    <BubbleGalaxy bind:this={galaxyComponent} bind:nodes bind:latestEvents />

    {#if backgroundImage && backgroundImageAuthor}
      <a
        href="https://bsky.app/profile/{backgroundImageAuthorDid}"
        target="_blank"
        rel="noopener noreferrer"
        class="bg-author-info"
        in:fade={{ duration: 1000 }}
      >
        By {backgroundImageAuthor}
      </a>
    {/if}
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #0f172a;
  }

  .page-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
    color: white;
    position: relative;
    overflow: hidden;
  }

  .bg-image-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
  }

  .bg-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.8; /* Adjust transparency here */
    filter: blur(2px); /* Optional: blur for better text readability on top */
  }

  .bg-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at center, transparent 0%, #0f172a 90%);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    padding: 12px 24px;
    border-radius: 999px;
  }

  .bg-author-info {
    position: fixed;
    bottom: 20px;
    right: 20px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
    text-decoration: none;
    z-index: 100;
    pointer-events: auto;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: color 0.2s;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .bg-author-info:hover {
    color: white;
  }
</style>

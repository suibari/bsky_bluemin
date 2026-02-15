<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { fade } from "svelte/transition";
  import { browser } from "$app/environment";
  import { AtpAgent } from "@atproto/api";
  import { Jetstream, type CommitEvent } from "@skyware/jetstream";
  import BubbleGalaxy from "$lib/components/BubbleGalaxy.svelte";
  import { authState } from "$lib/auth";
  import * as d3 from "d3";

  // Public agent for resolving profiles
  const publicAgent = new AtpAgent({ service: "https://public.api.bsky.app" });
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
  let loading = $state(true); // Initially load until first event or connection? Maybe not needed for firehose.
  let error = $state<string | null>(null);
  let jetstream: Jetstream | null = null;
  let galaxyComponent = $state<BubbleGalaxy>();

  let backgroundImage = $state<string | null>(null);
  let backgroundImageKey = $state<number>(0);
  let backgroundImageAuthor = $state<string | null>(null);
  let backgroundImageAuthorDid = $state<string | null>(null);

  const POST_SAMPLING_RATE = 1000;
  const SAMPLE_POOL_SIZE = 2000;
  const BASE_RADIUS = 24;

  let processedCount = 0;

  $effect(() => {
    if (browser) {
      connectJetStream();
    }
    return () => {
      cleanup();
    };
  });

  function cleanup() {
    if (jetstream) {
      jetstream.close();
      jetstream = null;
    }
  }

  function connectJetStream() {
    cleanup();

    // Listen to all events
    jetstream = new Jetstream({
      wantedCollections: [
        "app.bsky.feed.post",
        "app.bsky.feed.like",
        "app.bsky.feed.repost",
        "app.bsky.graph.follow",
      ],
    });

    jetstream.on("commit", (event: CommitEvent<any>) => {
      if (event.commit.operation === "create") {
        processEvent(event);
      }
    });

    jetstream.start();
    loading = false;
  }

  async function processEvent(event: CommitEvent<any>) {
    // Sampling logic
    if (Math.random() * POST_SAMPLING_RATE >= 1) {
      return;
    }

    const did = event.did;

    // Check if node exists
    let authorNode = nodes.find((n) => n.did === did);

    if (!authorNode) {
      // Fetch profile
      try {
        const profile = await agent.getProfile({ actor: did });
        const p = profile.data;

        // Limit pool size
        if (nodes.length >= SAMPLE_POOL_SIZE) {
          nodes.shift(); // Remove oldest
        }

        // Random position from center
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 200 + 50; // Spawn closer for faster alignment

        authorNode = {
          did: did,
          avatar: p.avatar,
          displayName: p.displayName || p.handle,
          interactionCount: 0, // Will be incremented below
          sizeFactor: 1,
          radius: BASE_RADIUS,
          hasInteracted: false,
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle),
        };

        nodes.push(authorNode);
      } catch (e) {
        // Failed to fetch profile, skip
        return;
      }
    }

    // Process interaction
    const commit = event.commit as any;
    const record = commit.record;
    let type = "";
    let text = "";
    let url = "";
    const rkey = commit.rkey;

    switch (commit.collection) {
      case "app.bsky.feed.post":
        type = "post";
        text = record.text || "";
        url = `https://bsky.app/profile/${did}/post/${rkey}`;

        // Check for images in the post itself
        if (
          record.embed &&
          (record.embed.$type === "app.bsky.embed.images" ||
            record.embed.$type === "app.bsky.embed.recordWithMedia")
        ) {
          try {
            const postUri = `at://${did}/app.bsky.feed.post/${rkey}`;
            // We use the public agent or authenticated agent to fetch the post view
            const res = await agent.getPosts({ uris: [postUri] });
            if (res.data.posts.length > 0) {
              const postView = res.data.posts[0];
              if (isSafeContent(postView)) {
                const img = extractImageFromPostView(postView.embed);
                if (img) {
                  backgroundImage = img;
                  backgroundImageKey++;
                  backgroundImageAuthor =
                    postView.author.displayName || postView.author.handle;
                  backgroundImageAuthorDid = postView.author.did;
                }
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
                if (isSafeContent(postView)) {
                  const img = extractImageFromPostView(postView.embed);
                  if (img) {
                    backgroundImage = img;
                    backgroundImageKey++;
                    backgroundImageAuthor =
                      postView.author.displayName || postView.author.handle;
                    backgroundImageAuthorDid = postView.author.did;
                  }
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

    // Update node state
    authorNode.interactionCount += 1;
    authorNode.sizeFactor = 1 + Math.log10(authorNode.interactionCount + 1);
    authorNode.radius = BASE_RADIUS * authorNode.sizeFactor;
    authorNode.hasInteracted = true;

    // Trigger update
    nodes = [...nodes];
    latestEvents.set(did, newEvent);
    latestEvents = new Map(latestEvents);

    if (galaxyComponent) {
      galaxyComponent.notifyInteraction();
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

  function isSafeContent(postView: any): boolean {
    const unsafeLabels = [
      "porn",
      "sexual",
      "nudity",
      "graphic-media",
      "sexual-figurative",
      "sexual-explicit",
      "intolerant",
      "spam",
    ];

    // Check post labels
    if (postView.labels && Array.isArray(postView.labels)) {
      for (const label of postView.labels) {
        if (unsafeLabels.includes(label.val)) return false;
      }
    }

    // Check author labels
    if (
      postView.author &&
      postView.author.labels &&
      Array.isArray(postView.author.labels)
    ) {
      for (const label of postView.author.labels) {
        if (unsafeLabels.includes(label.val)) return false;
      }
    }

    return true;
  }
</script>

<div class="page-container">
  {#key backgroundImageKey}
    {#if backgroundImage}
      <div class="bg-image-container" transition:fade={{ duration: 1000 }}>
        <img src={backgroundImage} alt="" class="bg-image" />
        <div class="bg-overlay"></div>
      </div>
    {/if}
  {/key}

  <div class="overlay-info">
    <h1>Global Feed</h1>
    <p>Sampling 1/{POST_SAMPLING_RATE} posts • Max {SAMPLE_POOL_SIZE} nodes</p>
  </div>

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

  .overlay-info {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 10;
    pointer-events: none;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
  }

  p {
    margin: 4px 0 0;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
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
    opacity: 0.8;
    filter: blur(2px);
  }

  .bg-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at center, transparent 0%, #0f172a 90%);
  }

  .bg-author-info {
    position: absolute;
    bottom: 20px;
    right: 20px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8rem;
    text-decoration: none;
    z-index: 10;
    transition: color 0.2s;
  }

  .bg-author-info:hover {
    color: white;
  }
</style>

<script lang="ts">
  import { onMount, onDestroy, untrack, tick } from "svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { AtpAgent } from "@atproto/api";
  import { Jetstream, type CommitEvent } from "@skyware/jetstream";
  import AvatarNode from "$lib/components/AvatarNode.svelte";
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
  let simulation: d3.Simulation<Node, undefined> | null = null;
  let decayInterval: any;

  let zoomContainer = $state<HTMLElement | null>(null);
  let transform = $state({ x: 0, y: 0, k: 1 });

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
      initSimulation();
    } catch (e) {
      console.error(e);
      error = "Failed to fetch follows.";
    } finally {
      loading = false;
    }
  }

  function initSimulation() {
    if (!browser) return;

    simulation = d3
      .forceSimulation<Node>(nodes)
      .velocityDecay(0.01)
      .alphaDecay(0.05)
      .force("charge", d3.forceManyBody<Node>().strength(-20))
      .force(
        "radial",
        d3.forceRadial<Node>(0, 0, 0).strength((d) => {
          // Interacted nodes pushed strongly to center, others pulled weakly
          return d.hasInteracted ? 0.8 : 0.03;
        }),
      )
      .force(
        "collide",
        d3
          .forceCollide<Node>((d) => d.radius + 12)
          .strength(1)
          .iterations(8),
      )
      .on("tick", () => {
        nodes = [...nodes];
      });
  }

  function cleanup() {
    if (jetstream) {
      jetstream.close();
      jetstream = null;
    }
    if (simulation) {
      simulation.stop();
      simulation = null;
    }
    if (decayInterval) {
      clearInterval(decayInterval);
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
          if (zoomContainer) {
            const zoom = d3
              .zoom<HTMLElement, unknown>()
              .scaleExtent([0.1, 5])
              .on("zoom", (event) => {
                const { x, y, k } = event.transform;
                transform = { x, y, k };
              });

            d3.select(zoomContainer).call(zoom);
          }

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

    decayInterval = setInterval(() => {
      let changed = false;
      nodes.forEach((node) => {
        if (node.interactionCount > 0) {
          node.interactionCount = Math.max(0, node.interactionCount - 0.01);
          const oldSize = node.sizeFactor;
          node.sizeFactor = 1 + Math.log10(node.interactionCount + 1);
          node.radius = BASE_RADIUS * node.sizeFactor;
          if (Math.abs(oldSize - node.sizeFactor) > 0.01) {
            changed = true;
          }
        }
      });
      if (changed && simulation) {
        nodes = [...nodes]; // Trigger reactivity for sizeFactor updates
        // Update collision force to account for new radii
        simulation.force(
          "collide",
          d3
            .forceCollide<Node>((d) => d.radius + 12)
            .strength(1)
            .iterations(8),
        );
        simulation.alphaTarget(0.1).restart();
        setTimeout(() => simulation?.alphaTarget(0), 100);
      }
    }, 1000);

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

      if (simulation) {
        // Update forces to apply new strength for interacted node
        simulation.force(
          "radial",
          d3.forceRadial<Node>(0, 0, 0).strength((d) => {
            return d.hasInteracted ? 0.8 : 0.03;
          }),
        );
        simulation.force(
          "collide",
          d3
            .forceCollide<Node>((d) => d.radius + 12)
            .strength(1)
            .iterations(8),
        );
        simulation.alphaTarget(0.8).restart();
        setTimeout(() => simulation?.alphaTarget(0), 100);
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

  $effect(() => {
    if (browser && innerWidth && simulation) {
      simulation.alpha(0.3).restart();
    }
  });
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
    <div class="zoom-container" bind:this={zoomContainer}>
      <div
        class="transform-layer"
        style="transform: translate({transform.x}px, {transform.y}px) scale({transform.k});"
      >
        <div class="nodes-wrapper">
          {#each nodes as node (node.did)}
            <AvatarNode
              did={node.did}
              avatar={node.avatar}
              displayName={node.displayName}
              event={latestEvents.get(node.did)}
              x={node.x ?? 0}
              y={node.y ?? 0}
              sizeFactor={node.sizeFactor}
              baseRadius={BASE_RADIUS}
              hasInteracted={node.hasInteracted}
            />
          {/each}
        </div>
      </div>
    </div>
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

  .zoom-container {
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .zoom-container:active {
    cursor: grabbing;
  }

  .transform-layer {
    width: 100%;
    height: 100%;
    transform-origin: 0 0;
  }

  .nodes-wrapper {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0;
    height: 0;
  }

  .status-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    z-index: 100;
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
</style>

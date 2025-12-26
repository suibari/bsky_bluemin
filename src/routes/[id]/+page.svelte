<script lang="ts">
  import { onMount, tick } from "svelte";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { AtpAgent } from "@atproto/api";
  import { Jetstream, type CommitEvent } from "@skyware/jetstream";
  import AvatarNode from "$lib/components/AvatarNode.svelte";
  import * as d3 from "d3-force";

  let id = $derived(page.params.id);
  let agent = new AtpAgent({ service: "https://public.api.bsky.app" });

  interface InteractionEvent {
    type: string;
    uri: string;
    author: string;
    authorAvatar?: string;
    authorDisplayName: string;
    text: string;
    image?: string;
    timestamp: string;
    id: string; // unique id for each instance of event
    url?: string;
  }

  interface Node extends d3.SimulationNodeDatum {
    did: string;
    avatar?: string;
    displayName: string;
    interactionCount: number;
    sizeFactor: number;
    radius: number;
  }

  // To trigger reactions in AvatarNode, we store the latest event per author
  let latestEvents = $state<Map<string, InteractionEvent>>(new Map());
  let nodes = $state<Node[]>([]);

  let loading = $state(true);
  let error = $state<string | null>(null);
  let jetstream: Jetstream | null = null;
  let simulation: d3.Simulation<Node, undefined> | null = null;
  let decayInterval: any;

  const MAX_FOLLOWEES = 256;
  const BASE_RADIUS = 24; // 48 / 2

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
      const allFollows: Node[] = [];

      do {
        const res = await agent.getFollows({
          actor: did,
          cursor,
          limit: 100,
        });

        const batch = res.data.follows.map((f) => ({
          did: f.did,
          avatar: f.avatar,
          displayName: f.displayName || f.handle,
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 400,
          interactionCount: 0,
          sizeFactor: 1,
          radius: BASE_RADIUS,
        }));

        allFollows.push(...batch);
        cursor = res.data.cursor;

        // Safety cap and respect the limit
        if (allFollows.length >= MAX_FOLLOWEES) {
          cursor = undefined;
        }
      } while (cursor);

      nodes = allFollows.slice(0, MAX_FOLLOWEES);
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
      .velocityDecay(0.15) // Slightly more fluid
      .alphaDecay(0.005) // Stay active longer
      .force("charge", d3.forceManyBody().strength(-80)) // Balance density
      .force("x", d3.forceX(0).strength(0.15)) // Center X
      .force("y", d3.forceY(0).strength(0.15)) // Center Y
      .force(
        "collide",
        d3.forceCollide<Node>((d) => d.radius + 15).iterations(8),
      )
      .on("tick", () => {
        nodes = [...nodes]; // Trigger reactivity
      });
  }

  onMount(() => {
    const init = async () => {
      try {
        const targetDid = await resolveId(id || "");
        await fetchFollows(targetDid);

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

    // Decay loop for sizing and simulation alpha update
    decayInterval = setInterval(() => {
      let changed = false;
      nodes.forEach((node) => {
        if (node.interactionCount > 0) {
          node.interactionCount = Math.max(0, node.interactionCount - 0.01);
          const oldSize = node.sizeFactor;
          node.sizeFactor =
            1 + Math.min(1.5, Math.log10(node.interactionCount + 1));
          node.radius = BASE_RADIUS * node.sizeFactor;
          if (Math.abs(oldSize - node.sizeFactor) > 0.01) {
            changed = true;
          }
        }
      });
      if (changed && simulation) {
        simulation.alphaTarget(0.1).restart();
        // Return to 0 alphaTarget shortly after
        setTimeout(() => simulation?.alphaTarget(0), 100);
      }
    }, 1000);

    return () => {
      if (jetstream) jetstream.close();
      if (simulation) simulation.stop();
      if (decayInterval) clearInterval(decayInterval);
    };
  });

  async function handleEvent(event: CommitEvent<any>) {
    const did = event.did;
    const authorNode = nodes.find((n) => n.did === did);
    if (!authorNode) return;

    const commit = event.commit;
    const record = commit.record as any;
    let type = "";
    let text = "";
    let url = "";

    const rkey = event.commit.rkey;
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
      // Increment interaction count and trigger simulation refresh
      authorNode.interactionCount += 1;
      authorNode.sizeFactor =
        1 + Math.min(1.5, Math.log10(authorNode.interactionCount + 1));
      authorNode.radius = BASE_RADIUS * authorNode.sizeFactor;
      if (simulation) {
        simulation.alphaTarget(0.3).restart();
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
</script>

<div class="page-container">
  {#if loading}
    <div class="status-overlay">
      <div class="spinner"></div>
      <p>Gathering your circle...</p>
    </div>
  {:else if error}
    <div class="status-overlay">
      <p class="error">{error}</p>
    </div>
  {:else}
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
        />
      {/each}
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

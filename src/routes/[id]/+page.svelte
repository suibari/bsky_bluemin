<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { AtpAgent } from "@atproto/api";
  import { Jetstream, type CommitEvent } from "@skyware/jetstream";
  import InteractionBubble from "$lib/components/InteractionBubble.svelte";
  import { Search } from "lucide-svelte";

  let id = $derived(page.params.id);
  let agent = new AtpAgent({ service: "https://public.api.bsky.app" });
  let events = $state<
    {
      type: string;
      uri: string;
      author: string;
      avatar?: string;
      displayName?: string;
      text?: string;
      timestamp: string;
    }[]
  >([]);
  let followees = $state<Set<string>>(new Set());
  let profileMap = $state<
    Map<string, { avatar?: string; displayName?: string }>
  >(new Map());
  let loading = $state(true);
  let error = $state<string | null>(null);
  let jetstream: Jetstream | null = null;

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
    let cursor: string | undefined;
    const allFollows = new Set<string>();
    try {
      loading = true;
      do {
        const res = await agent.getFollows({ actor: did, cursor, limit: 100 });
        res.data.follows.forEach((f) => {
          allFollows.add(f.did);
          profileMap.set(f.did, {
            avatar: f.avatar,
            displayName: f.displayName,
          });
        });
        cursor = res.data.cursor;
      } while (cursor);
      followees = allFollows;
    } catch (e) {
      console.error(e);
      error = "Failed to fetch follows.";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    let cleanup: () => void;

    const init = async () => {
      try {
        const did = await resolveId(id);
        await fetchFollows(did);

        if (browser && followees.size > 0) {
          jetstream = new Jetstream({
            wantedCollections: [
              "app.bsky.feed.post",
              "app.bsky.feed.like",
              "app.bsky.feed.repost",
              "app.bsky.graph.follow",
            ],
            wantedDids: Array.from(followees),
          });

          jetstream.on("commit", (event: CommitEvent) => {
            console.log(
              "Received commit:",
              event.did,
              event.commit.collection,
              event.commit.operation,
            );
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
      if (jetstream) jetstream.close();
    };
  });

  function handleEvent(event: CommitEvent) {
    const did = event.did;
    if (!followees.has(did)) {
      console.log("Filtered out DID:", did);
      return;
    }
    console.log("Processing event for DID:", did);

    const profile = profileMap.get(did);
    let type = "";
    let text = "";

    const commit = event.commit;
    switch (commit.collection) {
      case "app.bsky.feed.post":
        type = "post";
        text = (commit.record as any).text || "";
        break;
      case "app.bsky.feed.like":
        type = "like";
        text = "Liked a post";
        break;
      case "app.bsky.feed.repost":
        type = "repost";
        text = "Reposted a post";
        break;
      case "app.bsky.graph.follow":
        type = "follow";
        text = `Followed ${(commit.record as any).subject}`;
        break;
    }

    if (type) {
      events = [
        {
          type,
          uri: event.commit.rev, // Simple unique key, rev is not quite right for URI but works for key
          author: did,
          avatar: profile?.avatar,
          displayName: profile?.displayName || did,
          text,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...events,
      ].slice(0, 100);
    }
  }
</script>

<div class="chat-container">
  {#if loading}
    <div class="status-msg">Loading followees...</div>
  {:else if error}
    <div class="status-msg error">{error}</div>
  {:else if events.length === 0}
    <div class="status-msg">Waiting for interactions from followees...</div>
  {/if}

  <div class="messages">
    {#each events as event (event.uri + event.timestamp)}
      <InteractionBubble {event} />
    {/each}
  </div>
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 60px);
    background-color: #7494c0; /* LINE blue-ish background */
    overflow-y: auto;
    padding: 10px;
  }

  .messages {
    display: flex;
    flex-direction: column-reverse; /* Bottom to top */
    gap: 12px;
  }

  .status-msg {
    text-align: center;
    padding: 20px;
    color: white;
    font-size: 0.9rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    margin: 10px;
  }

  .error {
    background: rgba(255, 0, 0, 0.3);
  }
</style>

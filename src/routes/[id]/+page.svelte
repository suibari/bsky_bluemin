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
  interface InteractionEvent {
    type: string;
    uri: string;
    author: string;
    authorAvatar?: string;
    authorDisplayName: string;
    text: string;
    timestamp: string;
    subject?: {
      displayName?: string;
      avatar?: string;
      text?: string;
      image?: string;
      did?: string;
    };
  }

  let events = $state<InteractionEvent[]>([]);
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

  async function handleEvent(event: CommitEvent) {
    const did = event.did;
    if (!followees.has(did)) return;

    const commit = event.commit;
    const record = commit.record as any;
    let type = "";
    let text = "";
    let subject: InteractionEvent["subject"] = undefined;

    // Reply filtering
    if (commit.collection === "app.bsky.feed.post" && record.reply) {
      const parentUri = record.reply.parent.uri;
      const parentDid = parentUri ? parentUri.split("/")[2] : "";
      const targetDid = await resolveId(id || "");
      if (parentDid && !followees.has(parentDid) && parentDid !== targetDid) {
        return;
      }
    }

    switch (commit.collection) {
      case "app.bsky.feed.post":
        type = "post";
        text = record.text || "";
        break;
      case "app.bsky.feed.like":
      case "app.bsky.feed.repost":
        type = commit.collection === "app.bsky.feed.like" ? "like" : "repost";
        const subjectUri = record.subject.uri;
        try {
          const res = await agent.getPosts({ uris: [subjectUri] });
          if (res.data.posts.length > 0) {
            const post = res.data.posts[0];
            subject = {
              displayName: post.author.displayName || post.author.handle,
              avatar: post.author.avatar,
              text: (post.record as any).text,
              image: (post.embed as any)?.images?.[0]?.thumb,
              did: post.author.did,
            };
          }
        } catch (e) {
          console.error("Failed to fetch subject post", e);
        }
        text = type === "like" ? "Liked a post" : "Reposted a post";
        break;
      case "app.bsky.graph.follow":
        type = "follow";
        const subjectDid = record.subject;
        try {
          const res = await agent.getProfile({ actor: subjectDid });
          subject = {
            displayName: res.data.displayName || res.data.handle,
            avatar: res.data.avatar,
            did: res.data.did,
          };
        } catch (e) {
          console.error("Failed to fetch subject profile", e);
        }
        text = `Followed ${subject?.displayName || subjectDid}`;
        break;
    }

    if (type) {
      const profile = profileMap.get(did);
      const newEvent: InteractionEvent = {
        type,
        uri: commit.rev + Date.now(),
        author: did,
        authorAvatar: profile?.avatar,
        authorDisplayName: profile?.displayName || did || "Unknown",
        text,
        subject,
        timestamp: new Date().toLocaleTimeString(),
      };
      events = [newEvent, ...events].slice(0, 100);
    }
  }
</script>

<div class="chat-container">
  {#each events as event (event.uri + event.timestamp)}
    <InteractionBubble {event} />
  {/each}

  {#if loading}
    <div class="status-msg">Loading followees...</div>
  {:else if error}
    <div class="status-msg error">{error}</div>
  {:else if events.length === 0}
    <div class="status-msg">Waiting for interactions from followees...</div>
  {/if}
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column-reverse; /* Natively anchors to bottom, newest items push older up */
    height: calc(100vh - 60px);
    background-color: #7494c0;
    overflow-y: auto;
    padding: 10px;
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

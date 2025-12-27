import { BrowserOAuthClient, type ClientMetadata } from '@atproto/oauth-client-browser';
import type { AtpAgent } from '@atproto/api';
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const authState = writable<{
  isAuthenticated: boolean;
  user: any | null;
  agent: AtpAgent | null;
  loading: boolean;
  error: string | null;
}>({
  isAuthenticated: false,
  user: null,
  agent: null,
  loading: true,
  error: null
});

let client: BrowserOAuthClient | null = null;
const enc = encodeURIComponent;

let isInitializing = false;

export async function initAuth() {
  if (!browser) return;
  if (isInitializing) {
    console.log("[Auth] initAuth already running, skipping");
    return;
  }
  isInitializing = true;
  console.log("[Auth] initAuth started");

  try {
    const isDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const publicUrl = isDev ? window.location.origin : 'https://bluemin.suibari.com';
    console.log("[Auth] isDev:", isDev, "publicUrl:", publicUrl);

    let metadata: ClientMetadata;

    if (isDev) {
      // Development configuration: Use localhost client ID pattern
      const redirectUri = `${publicUrl}`;
      const scope = 'atproto transition:generic';

      metadata = {
        client_id: `http://localhost?redirect_uri=${enc(redirectUri)}&scope=${enc(scope)}`,
        client_name: "Bluesky Bluemin (Dev)",
        client_uri: 'http://127.0.0.1:5173',
        redirect_uris: [redirectUri],
        scope: scope,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        application_type: "web",
        token_endpoint_auth_method: "none",
        dpop_bound_access_tokens: true,
      } as unknown as ClientMetadata; // Aggressive cast to silence TS error
    } else {
      // Production configuration
      metadata = await (await fetch('/client-metadata.json')).json();
    }

    client = new BrowserOAuthClient({
      handleResolver: 'https://bsky.social',
      clientMetadata: metadata,
    });



    console.log("[Auth] client initialized, calling init()");

    // Create a timeout promise
    const timeoutPromise = new Promise<undefined>((resolve) => {
      setTimeout(() => {
        console.warn("[Auth] client.init() timed out");
        resolve(undefined);
      }, 5000); // 5 second timeout
    });

    // Race client.init against timeout
    const result = await Promise.race([client.init(), timeoutPromise]);

    console.log("[Auth] client.init() result:", result ? "Session found" : "No session/Timed out");

    if (result) {
      const { session } = result;

      authState.set({
        isAuthenticated: true,
        user: { handle: session.did },
        agent: null,
        loading: false,
        error: null
      });

      // Restore redirection if pending
      const redirectTo = sessionStorage.getItem('redirect_to');
      if (redirectTo) {
        // Remove it so we don't redirect on subsequent reloads
        sessionStorage.removeItem('redirect_to');
        // Use window.location.href to redirect if we are not already there
        if (window.location.pathname + window.location.search !== redirectTo) {
          window.location.href = redirectTo;
        }
      }

    } else {
      console.log("[Auth] No session found (or timed out), setting loading=false");
      authState.update(s => {
        console.log("[Auth] Updating store state: loading=false");
        return {
          ...s,
          isAuthenticated: false,
          user: null,
          agent: null,
          loading: false,
          error: null
        };
      });
    }

  } catch (e: any) {
    console.error("Auth init error:", e);
    authState.update(s => ({
      ...s,
      isAuthenticated: false,
      user: null,
      agent: null,
      loading: false,
      error: e.message
    }));
  } finally {
    isInitializing = false;
  }
}

export async function signIn(handle: string) {
  if (!client) return;
  try {
    // Save the current location to redirect back to
    sessionStorage.setItem('redirect_to', window.location.pathname + window.location.search);

    await client.signIn(handle, {
      prompt: 'login',
      ui_locales: 'ja-JP',
    });
  } catch (e) {
    console.error("Sign in error:", e);
  }
}

export async function signOut() {
  if (!client) return;

  // Retrieve current DID from store before it's cleared
  let did: string | undefined;
  authState.update(state => {
    did = state.user?.handle;
    return state;
  });

  try {
    if (did) {
      await client.revoke(did);
    }
  } catch (e) {
    console.error("Sign out error:", e);
  }

  // Force reload to clear any memory state and re-init
  location.reload();
}

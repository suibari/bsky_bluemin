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

export async function initAuth() {
  if (!browser) return;

  try {
    const isDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const publicUrl = isDev ? 'http://127.0.0.1:5173' : 'https://bluemin.suibari.com';

    let metadata: ClientMetadata;

    if (isDev) {
      // Development configuration: Use localhost client ID pattern to bypass HTTPS restrictions
      // See https://github.com/suibari/drawat/blob/main/src/lib/oauth.ts reference
      // Redirect URI must be loopback IP
      const redirectUri = `${publicUrl}`; // http://127.0.0.1:5173
      const scope = 'atproto transition:generic';

      metadata = {
        client_id: `http://localhost?redirect_uri=${enc(redirectUri)}&scope=${enc(scope)}`,
        client_name: "Bluesky Bluemin (Dev)",
        client_uri: publicUrl,
        redirect_uris: [redirectUri],
        scope: scope,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        application_type: "web",
        token_endpoint_auth_method: "none",
        dpop_bound_access_tokens: true,
      };
    } else {
      // Production configuration: Fetch static metadata file
      metadata = await (await fetch('/client-metadata.json')).json();
    }

    client = new BrowserOAuthClient({
      handleResolver: 'https://bsky.social',
      clientMetadata: metadata,
    });

    const result = await client.init();

    if (result) {
      const { session } = result;

      authState.set({
        isAuthenticated: true,
        user: { handle: session.did },
        agent: null,
        loading: false,
        error: null
      });

    } else {
      authState.set({
        isAuthenticated: false,
        user: null,
        agent: null,
        loading: false,
        error: null
      });
    }

  } catch (e: any) {
    console.error("Auth init error:", e);
    authState.set({
      isAuthenticated: false,
      user: null,
      agent: null,
      loading: false,
      error: e.message
    });
  }
}

export async function signIn(handle: string) {
  if (!client) return;
  try {
    await client.signIn(handle, {
      prompt: 'login',
      ui_locales: 'ja-JP',
    });
  } catch (e) {
    console.error("Sign in error:", e);
  }
}

export async function signOut() {
  location.reload();
}

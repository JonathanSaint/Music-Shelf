import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

import { auth } from '../lib/firebase';

export const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-top-read',
  'user-read-recently-played',
  'user-read-playback-state',
  'user-read-currently-playing',
];

export const spotifyDiscovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

/**
 * Register these redirect URIs in Spotify Developer Dashboard → your app → Redirect URIs.
 * Native: musicshelf://spotify-callback
 * Web: add the exact origin Spotify returns (e.g. https://your-app.vercel.app/spotify-callback) in the Spotify Dashboard.
 */
export function getSpotifyRedirectUri() {
  if (Platform.OS !== 'web') {
    return AuthSession.makeRedirectUri({
      native: 'musicshelf://spotify-callback',
      scheme: 'musicshelf',
      path: 'spotify-callback',
    });
  }

  // Stable origin-based URI — must match Spotify Developer Dashboard exactly.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}/spotify-callback`;
  }

  return AuthSession.makeRedirectUri({
    scheme: 'musicshelf',
    path: 'spotify-callback',
  });
}

function spotifyTokenProxyUrl() {
  const base = (process.env.EXPO_PUBLIC_AI_API_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/api/spotify-token` : '/api/spotify-token';
}

/**
 * Spotify's token endpoint does not allow browser CORS. Web uses the same Vercel proxy as AI insights.
 */
async function spotifyTokenViaProxy(payload) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to connect Spotify in the browser.');
  }
  const idToken = await user.getIdToken();
  const url = spotifyTokenProxyUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Spotify on the web needs the /api/spotify-token route. Deploy the api folder (for example with Vercel), set EXPO_PUBLIC_AI_API_BASE_URL to that deployment, and add your web redirect URI in the Spotify app settings.'
      );
    }
    const detail = json.error || json.error_description || `Spotify token proxy error (${res.status})`;
    if (res.status === 400 && /redirect/i.test(String(detail))) {
      throw new Error(`Redirect URI mismatch: ${detail}`);
    }
    throw new Error(detail);
  }
  return json;
}

export async function exchangeSpotifyCode({ code, redirectUri, clientId, codeVerifier }) {
  if (Platform.OS === 'web') {
    return spotifyTokenViaProxy({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    });
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const res = await fetch(spotifyDiscovery.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `Spotify token error (${res.status})`);
  }
  return json;
}

export async function refreshSpotifyAccessToken({ refreshToken, clientId }) {
  if (Platform.OS === 'web') {
    return spotifyTokenViaProxy({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const res = await fetch(spotifyDiscovery.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `Spotify refresh error (${res.status})`);
  }
  return json;
}

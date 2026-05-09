import * as AuthSession from 'expo-auth-session';

export const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-top-read',
  'user-read-recently-played',
];

export const spotifyDiscovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

/**
 * Register these redirect URIs in Spotify Developer Dashboard → your app → Redirect URIs.
 * Native: musicshelf://spotify-callback
 * Web dev: http://localhost:8081 (or your Expo web URL origin + path if you customize)
 */
export function getSpotifyRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: 'musicshelf',
    path: 'spotify-callback',
  });
}

export async function exchangeSpotifyCode({ code, redirectUri, clientId, codeVerifier }) {
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

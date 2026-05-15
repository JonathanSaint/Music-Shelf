import { Platform } from 'react-native';

import { exchangeSpotifyCode, getSpotifyRedirectUri } from './spotifyAuth';
import { clearPendingOAuthSession, loadPendingOAuthSession } from './spotifyOAuthSession';
import { saveSpotifyTokens, syncSpotifyProfileToFirestore } from './spotifyFirestore';

function parseCallbackParams() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return {};
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return {
    code: search.get('code') || hash.get('code'),
    error: search.get('error') || hash.get('error'),
    error_description: search.get('error_description') || hash.get('error_description'),
  };
}

export function mapSpotifyOAuthError(raw) {
  const msg = String(raw || '').toLowerCase();
  if (!msg) return 'Spotify login failed. Please try again.';
  if (/access_denied|consent|cancel/i.test(msg)) {
    return 'Spotify access was not granted. Tap Connect again and approve all requested permissions.';
  }
  if (/invalid.*redirect|redirect_uri/i.test(msg)) {
    return 'Redirect URI mismatch. Copy the redirect URI from Profile into your Spotify Developer Dashboard, then try again.';
  }
  if (/invalid.*client/i.test(msg)) {
    return 'Spotify Client ID is invalid. Check EXPO_PUBLIC_SPOTIFY_CLIENT_ID in your environment.';
  }
  if (/invalid.*code|code_verifier|pkce/i.test(msg)) {
    return 'Login session expired. Close this tab, return to Music Shelf, and connect again.';
  }
  if (/network|fetch|failed to fetch/i.test(msg)) {
    return 'Network error reaching Spotify. Check your connection and try again.';
  }
  if (/spotify-token|404|proxy|cors/i.test(msg)) {
    return 'Web Spotify login needs the deployed /api/spotify-token route. Set EXPO_PUBLIC_AI_API_BASE_URL to your Vercel URL and redeploy.';
  }
  if (/firebase|signed in|id token/i.test(msg)) {
    return 'Sign in to Music Shelf with email/password before connecting Spotify.';
  }
  if (/401|unauthorized|token/i.test(msg)) {
    return 'Spotify authorization failed. Try again — if you use Apple/Google/phone sign-in for Spotify, approve the permission screen when it appears.';
  }
  if (/user not registered|not been registered|development mode/i.test(msg)) {
    return 'This Spotify account is not on your app allowlist yet. In Spotify Developer Dashboard → Users and Access, add their Spotify email, then try again.';
  }
  return raw;
}

/**
 * Completes OAuth after redirect to /spotify-callback (web) or when the hook receives a code.
 */
export async function completeSpotifyOAuthFromCallback(explicitParams) {
  const params = explicitParams || parseCallbackParams();

  if (params.error) {
    throw new Error(mapSpotifyOAuthError(params.error_description || params.error));
  }

  const code = params.code;
  if (!code) return { status: 'no_code' };

  const pending = await loadPendingOAuthSession();
  if (!pending?.codeVerifier || !pending?.uid) {
    throw new Error(mapSpotifyOAuthError('Missing PKCE verifier — connect from Profile and try again.'));
  }

  const { auth } = await import('../lib/firebase');
  const currentUid = auth.currentUser?.uid;
  if (currentUid && pending.uid !== currentUid) {
    await clearPendingOAuthSession();
    throw new Error(
      'Spotify login was started for a different Music Shelf account. Sign in with the correct email, then connect again.'
    );
  }

  const clientId = pending.clientId || process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
  if (!clientId) {
    throw new Error('Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID in .env');
  }

  const redirectUri = pending.redirectUri || getSpotifyRedirectUri();

  const tokens = await exchangeSpotifyCode({
    code,
    redirectUri,
    clientId,
    codeVerifier: pending.codeVerifier,
  });

  if (!tokens?.access_token) {
    throw new Error('Spotify returned an invalid token response.');
  }

  await saveSpotifyTokens(pending.uid, tokens);
  await syncSpotifyProfileToFirestore(pending.uid, pending.email || null);
  await clearPendingOAuthSession();

  return { status: 'success' };
}

import { ResponseType, useAuthRequest } from 'expo-auth-session';
import React from 'react';
import { Platform } from 'react-native';

import {
  completeSpotifyOAuthFromCallback,
  mapSpotifyOAuthError,
} from '../services/spotifyOAuthComplete';
import { savePendingOAuthSession } from '../services/spotifyOAuthSession';
import {
  exchangeSpotifyCode,
  getSpotifyRedirectUri,
  SPOTIFY_SCOPES,
  spotifyDiscovery,
} from '../services/spotifyAuth';
import { saveSpotifyTokens, syncSpotifyProfileToFirestore } from '../services/spotifyFirestore';

const clientId = () => process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;

/**
 * Spotify OAuth (PKCE). Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID and register the redirect URI in Spotify Dashboard.
 */
export function useSpotifyConnect({ uid, email, onCompleted, onError }) {
  const redirectUri = React.useMemo(() => getSpotifyRedirectUri(), []);
  const completedRef = React.useRef(onCompleted);
  const errorRef = React.useRef(onError);

  React.useEffect(() => {
    completedRef.current = onCompleted;
  }, [onCompleted]);

  React.useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  const cid = clientId();
  const hasClientId = !!cid && cid !== 'missing-client-id';

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: cid || 'missing-client-id',
      scopes: SPOTIFY_SCOPES,
      redirectUri,
      responseType: ResponseType.Code,
      usePKCE: true,
      extraParams: {
        show_dialog: 'true',
      },
    },
    spotifyDiscovery
  );

  const handledCodeRef = React.useRef(null);

  const finishWithTokens = React.useCallback(
    async ({ code, verifier }) => {
      const id = clientId();
      if (!id || id === 'missing-client-id') {
        throw new Error('Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID in .env');
      }
      if (!verifier) {
        throw new Error('Missing PKCE verifier — try Connect again.');
      }
      if (!uid) {
        throw new Error('Not signed in');
      }

      const tokens = await exchangeSpotifyCode({
        code,
        redirectUri,
        clientId: id,
        codeVerifier: verifier,
      });
      if (!tokens?.access_token) {
        throw new Error('Spotify returned an invalid token response. Please try again.');
      }
      await saveSpotifyTokens(uid, tokens);
      await syncSpotifyProfileToFirestore(uid, email);
      completedRef.current?.();
    },
    [redirectUri, uid, email]
  );

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (response?.type !== 'success') {
        if (response?.type === 'error') {
          const errMsg = response.error?.message || response.params?.error_description || response.params?.error;
          if (!cancelled) errorRef.current?.(new Error(mapSpotifyOAuthError(errMsg)));
        }
        return;
      }
      const code = response.params?.code;
      if (!code) return;
      if (handledCodeRef.current === code) return;
      handledCodeRef.current = code;

      try {
        await finishWithTokens({ code, verifier: request?.codeVerifier });
      } catch (e) {
        console.error('Spotify connect error:', e);
        if (!cancelled) errorRef.current?.(new Error(mapSpotifyOAuthError(e?.message || String(e))));
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [response, request, finishWithTokens]);

  const connect = React.useCallback(async () => {
    const id = clientId();
    if (!id) {
      errorRef.current?.(new Error('Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID'));
      return { type: 'error' };
    }
    if (!request?.codeVerifier) {
      errorRef.current?.(new Error('Still preparing login — try again in a second.'));
      return { type: 'error' };
    }
    if (!uid) {
      errorRef.current?.(new Error('Sign in before connecting Spotify.'));
      return { type: 'error' };
    }

    await savePendingOAuthSession({
      codeVerifier: request.codeVerifier,
      redirectUri,
      uid,
      email: email || null,
      clientId: id,
    });

    return promptAsync({
      preferEphemeralSession: false,
      ...(Platform.OS === 'web' ? { windowName: 'SpotifyAuth' } : {}),
    });
  }, [promptAsync, request, redirectUri, uid, email]);

  const ready = !!request && hasClientId;

  return { connect, ready, hasClientId, loadingRequest: !request, redirectUri };
}

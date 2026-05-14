import { ResponseType, useAuthRequest } from 'expo-auth-session';
import React from 'react';
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
      /**
       * Removed show_dialog: 'true' to allow seamless re-authentication for
       * Apple/Google/phone-created Spotify accounts. Spotify will show the
       * consent screen when needed.
       */
      extraParams: {
        show_dialog: 'false',
      },
    },
    spotifyDiscovery
  );

  const handledCodeRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (response?.type !== 'success') return;
      const code = response.params?.code;
      if (!code) return;
      if (handledCodeRef.current === code) return;
      handledCodeRef.current = code;

      const verifier = request?.codeVerifier;
      const id = clientId();

      if (!id || id === 'missing-client-id') {
        errorRef.current?.(new Error('Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID in .env'));
        return;
      }
      if (!verifier) {
        errorRef.current?.(new Error('Missing PKCE verifier — try Connect again.'));
        return;
      }
      if (!uid) {
        errorRef.current?.(new Error('Not signed in'));
        return;
      }

      try {
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
        if (!cancelled) completedRef.current?.();
      } catch (e) {
        console.error('Spotify connect error:', e);
        if (!cancelled) {
          const errorMsg = e?.message || String(e);
          if (/UNAUTHORIZED/i.test(errorMsg) || /401/i.test(errorMsg)) {
            errorRef.current?.(new Error('Spotify session expired. Please reconnect.'));
          } else if (/invalid.*code/i.test(errorMsg.toLowerCase())) {
            errorRef.current?.(new Error('Invalid authorization code. Please try connecting again.'));
          } else {
            errorRef.current?.(e);
          }
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [response, request, redirectUri, uid, email]);

  const connect = React.useCallback(async () => {
    const id = clientId();
    if (!id) {
      errorRef.current?.(new Error('Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID'));
      return { type: 'error' };
    }
    return promptAsync({
      preferEphemeralSession: false,
    });
  }, [promptAsync]);

  const ready = !!request && hasClientId;

  return { connect, ready, hasClientId, loadingRequest: !request, redirectUri };
}

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { refreshSpotifyAccessToken } from './spotifyAuth';
import { fetchSpotifyIdentityBundle } from './spotifyApi';

const clientId = () => process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;

function snapshotExists(snap) {
  return typeof snap.exists === 'function' ? snap.exists() : snap.exists;
}

function tokensRef(uid) {
  return doc(db, 'users', uid, 'private', 'spotify');
}

function userRef(uid) {
  return doc(db, 'users', uid);
}

export async function saveSpotifyTokens(uid, tokenJson) {
  const expiresInSec = tokenJson.expires_in || 3600;
  const expiresAt = Date.now() + expiresInSec * 1000 - 60_000;
  await setDoc(
    tokensRef(uid),
    {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || null,
      expiresAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Merge-only refresh token if Spotify omits it on refresh response */
export async function mergeSpotifyTokens(uid, partial) {
  await setDoc(tokensRef(uid), { ...partial, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getSpotifyTokens(uid) {
  const snap = await getDoc(tokensRef(uid));
  if (!snapshotExists(snap)) return null;
  return snap.data();
}

export async function savePublicProfile(uid, firebaseUserEmail, bundle) {
  await setDoc(
    userRef(uid),
    {
      email: firebaseUserEmail || null,
      username:
        (bundle.displayName || '')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 24) || null,
      spotify: {
        id: bundle.spotifyUserId,
        displayName: bundle.displayName,
        imageUrl: bundle.imageUrl,
        topArtists: bundle.topArtists,
        topTracks: bundle.topTracks,
        genres: bundle.genres,
        recentlyPlayed: bundle.recentlyPlayed,
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getPublicProfile(uid) {
  const snap = await getDoc(userRef(uid));
  if (!snapshotExists(snap)) return null;
  return snap.data();
}

export async function ensureFreshAccessToken(uid) {
  let data = await getSpotifyTokens(uid);
  if (!data?.refreshToken && !data?.accessToken) return null;

  const cid = clientId();
  if (!cid) throw new Error('Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID');

  if (data.accessToken && data.expiresAt && Date.now() < data.expiresAt) {
    return data.accessToken;
  }

  if (!data.refreshToken) return null;

  const refreshed = await refreshSpotifyAccessToken({
    refreshToken: data.refreshToken,
    clientId: cid,
  });

  await mergeSpotifyTokens(uid, {
    accessToken: refreshed.access_token,
    expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000 - 60_000,
    ...(refreshed.refresh_token ? { refreshToken: refreshed.refresh_token } : {}),
  });

  return refreshed.access_token;
}

export async function syncSpotifyProfileToFirestore(uid, firebaseUserEmail) {
  const accessToken = await ensureFreshAccessToken(uid);
  if (!accessToken) throw new Error('No Spotify session — connect Spotify first.');

  const bundle = await fetchSpotifyIdentityBundle(accessToken);
  await savePublicProfile(uid, firebaseUserEmail, bundle);
  return bundle;
}

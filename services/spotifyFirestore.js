import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchSpotifyIdentityBundle, LISTENING_HISTORY_DAYS } from './spotifyApi';
import { refreshSpotifyAccessToken } from './spotifyAuth';

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

function previousRankMap(items = []) {
  return new Map(items.map((item, index) => [item.id || item.name, index + 1]));
}

function addMovement(items = [], previousRanks) {
  return items.map((item, index) => {
    const previousRank = previousRanks.get(item.id || item.name) || null;
    const currentRank = index + 1;
    return {
      ...item,
      rank: currentRank,
      previousRank,
      rankChange: previousRank ? previousRank - currentRank : null,
    };
  });
}

function normalizeRankingName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function rankingDedupeKey(item) {
  if (item?.id) return `id:${item.id}`;
  const norm = normalizeRankingName(item?.name);
  return norm ? `name:${norm}` : null;
}

function dedupeByIdOrName(items = []) {
  const seen = new Set();
  const idByName = new Map();
  const out = [];

  for (const item of items) {
    const norm = normalizeRankingName(item?.name);
    if (item?.id && norm) idByName.set(norm, item.id);
  }

  for (const item of items) {
    let key = rankingDedupeKey(item);
    if (!key && item) {
      out.push(item);
      continue;
    }
    const norm = normalizeRankingName(item?.name);
    if (!item?.id && norm && idByName.has(norm)) {
      key = `id:${idByName.get(norm)}`;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function applyMovementToWindow(raw, prevWindow) {
  const safe = raw || { topTracks: [], topArtists: [], albumRankings: [], epRankings: [], singleRankings: [] };
  const prev = prevWindow || {};
  return {
    topTracks: addMovement(dedupeByIdOrName(safe.topTracks || []), previousRankMap(prev.topTracks || [])),
    topArtists: addMovement(dedupeByIdOrName(safe.topArtists || []), previousRankMap(prev.topArtists || [])),
    albumRankings: addMovement(dedupeByIdOrName(safe.albumRankings || []), previousRankMap(prev.albumRankings || [])),
    epRankings: addMovement(dedupeByIdOrName(safe.epRankings || []), previousRankMap(prev.epRankings || [])),
    singleRankings: addMovement(dedupeByIdOrName(safe.singleRankings || []), previousRankMap(prev.singleRankings || [])),
  };
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

export async function disconnectSpotify(uid) {
  if (!uid) return;

  // Best-effort Spotify token revocation, then clear our local/server session data.
  // This prevents “looks disconnected” cases where stored tokens still allow refresh/sync.
  try {
    const existing = await getSpotifyTokens(uid);
    const cid = clientId();
    const revokeEndpoint = 'https://accounts.spotify.com/api/revoke';

    // Spotify accepts token revocation via standard OAuth2 revocation semantics.
    // If the token is invalid/expired, Spotify may reject—ignore.
    const revokeOne = async (token, hint) => {
      if (!token) return;
      if (!cid) return;
      const params = new URLSearchParams({ token, client_id: cid });
      if (hint) params.set('token_type_hint', hint);
      await fetch(revokeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }).catch(() => undefined);
    };

    await Promise.all([
      revokeOne(existing?.refreshToken, 'refresh_token'),
      revokeOne(existing?.accessToken, 'access_token'),
    ]);
  } catch {
    // Never block disconnect on revocation failures.
  }

  try {
    await deleteDoc(tokensRef(uid));
  } catch {
    /* doc may already be missing */
  }

  await setDoc(
    userRef(uid),
    {
      spotify: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function savePublicProfile(uid, firebaseUserEmail, bundle) {
  const existingSnap = await getDoc(userRef(uid));
  const existingSpotify = snapshotExists(existingSnap) ? existingSnap.data()?.spotify : null;
  const prevByWindow = existingSpotify?.playStatsByWindow || {};

  const playStatsByWindow = {};
  for (const days of LISTENING_HISTORY_DAYS) {
    const key = String(days);
    const raw = bundle.playStatsByWindow?.[key] || {
      topTracks: [],
      topArtists: [],
      albumRankings: [],
      epRankings: [],
      singleRankings: [],
    };
    playStatsByWindow[key] = applyMovementToWindow(raw, prevByWindow[key]);
  }

  const w30 = playStatsByWindow['30'];

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
        topArtists: w30.topArtists,
        topTracks: w30.topTracks,
        albumRankings: w30.albumRankings,
        epRankings: w30.epRankings,
        singleRankings: w30.singleRankings,
        playStatsByWindow,
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

export async function saveMusicInsight(uid, insight) {
  if (!uid || !insight) return;
  await setDoc(
    userRef(uid),
    {
      spotify: {
        aiInsight: insight,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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

export async function hasSpotifySession(uid) {
  if (!uid) return false;
  const tokens = await getSpotifyTokens(uid);
  return !!(tokens?.accessToken || tokens?.refreshToken);
}

export async function syncSpotifyProfileToFirestore(uid, firebaseUserEmail) {
  const accessToken = await ensureFreshAccessToken(uid);
  if (!accessToken) throw new Error('No Spotify session — connect Spotify first.');

  const bundle = await fetchSpotifyIdentityBundle(accessToken);
  await savePublicProfile(uid, firebaseUserEmail, bundle);
  return bundle;
}

export async function deleteSpotifyUserData(uid) {
  if (!uid) return;

  // Delete our stored Spotify token doc (if present)
  try {
    await deleteDoc(tokensRef(uid));
  } catch {
    /* ignore */
  }

  // Delete spotify data from the main user doc (merge-safe)
  try {
    await setDoc(
      userRef(uid),
      {
        spotify: deleteField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    /* ignore */
  }
}

export async function deleteFirebaseUserDoc(uid) {
  if (!uid) return;

  // Delete entire user document (includes non-Spotify fields too)
  // If your app stores more in /users/{uid}, this is correct.
  // If you later decide to keep some fields, we can swap this to per-field deletes.
  await deleteDoc(userRef(uid)).catch(() => undefined);
}

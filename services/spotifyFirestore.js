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

function releaseKindFromTrack(track) {
  const totalTracks = Number(track?.albumTotalTracks || 0);
  if (track?.albumType === 'album') return 'album';
  if (totalTracks >= 4 && totalTracks <= 6) return 'ep';
  return 'single';
}

function buildReleaseRankings(topTracks = [], kind = 'album') {
  const releases = new Map();
  topTracks.forEach((track, index) => {
    if (!track.albumName || releaseKindFromTrack(track) !== kind) return;
    const id = track.albumId || track.albumName;
    const current = releases.get(id) || {
      id,
      name: track.albumName,
      imageUrl: track.imageUrl,
      score: 0,
      tracks: 0,
      artists: new Set(),
      kind,
    };
    current.score += Math.max(1, 12 - index);
    current.tracks += 1;
    (track.artists || []).forEach((artist) => current.artists.add(artist.name));
    releases.set(id, current);
  });

  return Array.from(releases.values())
    .map((release) => ({ ...release, artists: Array.from(release.artists).slice(0, 2).join(', ') }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 5);
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
  const existingSnap = await getDoc(userRef(uid));
  const existingSpotify = snapshotExists(existingSnap) ? existingSnap.data()?.spotify : null;
  const albumRankings = buildReleaseRankings(bundle.topTracks, 'album');
  const epRankings = buildReleaseRankings(bundle.topTracks, 'ep');
  const singleRankings = buildReleaseRankings(bundle.topTracks, 'single');
  const topTracks = addMovement(bundle.topTracks, previousRankMap(existingSpotify?.topTracks || []));
  const albumsWithMovement = addMovement(albumRankings, previousRankMap(existingSpotify?.albumRankings || []));

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
        topTracks,
        albumRankings: albumsWithMovement,
        epRankings,
        singleRankings,
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

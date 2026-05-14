const API = 'https://api.spotify.com/v1';

const LISTENING_HISTORY_DAYS = [30, 80, 120];
const RECENT_PAGE_DELAY_MS = 120;
const MAX_RECENT_PAGES = 40;

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function spotifyGet(path, accessToken) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const data = await parseJson(res);
  if (res.status === 401) {
    const err = new Error('UNAUTHORIZED');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (!res.ok) {
    throw new Error(data.error?.message || `Spotify API ${res.status}`);
  }
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Paginate recently played until older than `oldestMs` or no more pages.
 */
export async function fetchRecentlyPlayedSince(accessToken, oldestMs) {
  const collected = [];
  let before;
  for (let page = 0; page < MAX_RECENT_PAGES; page += 1) {
    const qs = new URLSearchParams({ limit: '50' });
    if (before) qs.set('before', before);
    const data = await spotifyGet(`/me/player/recently-played?${qs}`, accessToken);
    const items = data.items || [];
    if (!items.length) break;

    for (const item of items) {
      const playedAt = new Date(item.played_at).getTime();
      if (playedAt >= oldestMs) collected.push(item);
    }

    const last = items[items.length - 1];
    const oldestInPage = new Date(last.played_at).getTime();
    before = last.played_at;
    if (oldestInPage < oldestMs) break;
    if (items.length < 50) break;
    await sleep(RECENT_PAGE_DELAY_MS);
  }
  return collected;
}

function releaseKindFromTrack(track) {
  const totalTracks = Number(track?.albumTotalTracks || 0);
  if (track?.albumType === 'album') return 'album';
  if (totalTracks >= 4 && totalTracks <= 6) return 'ep';
  return 'single';
}

function mapApiTrackToShape(t) {
  if (!t?.id) return null;
  return {
    id: t.id,
    name: t.name,
    previewUrl: t.preview_url || null,
    durationMs: t.duration_ms || 0,
    artists: (t.artists || []).map((x) => ({ id: x.id, name: x.name })),
    albumId: t.album?.id || null,
    albumName: t.album?.name || '',
    albumType: t.album?.album_type || null,
    albumTotalTracks: t.album?.total_tracks || null,
    albumReleaseDate: t.album?.release_date || null,
    imageUrl: t.album?.images?.[0]?.url || null,
  };
}

/**
 * Build play-count rankings for one time window from recently-played items.
 */
export function buildPlayStatsFromHistory(items) {
  const trackCounts = new Map();
  const artistCounts = new Map();

  for (const item of items) {
    const t = item.track;
    const mapped = mapApiTrackToShape(t);
    if (!mapped) continue;

    trackCounts.set(mapped.id, (trackCounts.get(mapped.id) || 0) + 1);

    for (const a of mapped.artists) {
      if (!a.id) continue;
      const cur = artistCounts.get(a.id) || { id: a.id, name: a.name, playCount: 0, imageUrl: null };
      cur.playCount += 1;
      if (!cur.imageUrl && mapped.imageUrl) cur.imageUrl = mapped.imageUrl;
      artistCounts.set(a.id, cur);
    }
  }

  const topTracks = Array.from(trackCounts.entries())
    .map(([id, count]) => {
      const sample = items.find((it) => it.track?.id === id)?.track;
      const base = mapApiTrackToShape(sample);
      return base ? { ...base, playCount: count, score: count } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.playCount - a.playCount || a.name.localeCompare(b.name))
    .slice(0, 20);

  const topArtists = Array.from(artistCounts.values())
    .sort((a, b) => b.playCount - a.playCount || a.name.localeCompare(b.name))
    .slice(0, 20)
    .map(({ id, name, playCount, imageUrl }) => ({
      id,
      name,
      imageUrl,
      genres: [],
      popularity: 0,
      followers: 0,
      playCount,
      score: playCount,
    }));

  const albumRankings = buildReleasePlayRankings(topTracks, 'album');
  const epRankings = buildReleasePlayRankings(topTracks, 'ep');
  const singleRankings = buildReleasePlayRankings(topTracks, 'single');

  return { topTracks, topArtists, albumRankings, epRankings, singleRankings };
}

function buildReleasePlayRankings(tracksWithCounts, kind) {
  const releases = new Map();
  for (const track of tracksWithCounts) {
    if (!track.albumName || releaseKindFromTrack(track) !== kind) continue;
    const id = track.albumId || track.albumName;
    const cur = releases.get(id) || {
      id,
      name: track.albumName,
      imageUrl: track.imageUrl,
      // keep both fields for backwards compatibility, but make `score` derived later
      score: 0,
      playCount: 0,
      trackIds: new Set(),
      artists: new Set(),
      kind,
    };

    // Canonical release play total = summed plays of tracks in this release.
    cur.playCount += track.playCount;
    cur.trackIds.add(track.id);
    (track.artists || []).forEach((artist) => cur.artists.add(artist.name));
    releases.set(id, cur);
  }

  return Array.from(releases.values())
    .map((release) => {
      const { trackIds, artists, ...rest } = release;
      return {
        ...rest,
        // Canonical release plays
        playCount: release.playCount,
        // Keep `score` aligned with playCount so existing UI stays correct.
        score: release.playCount,
        tracks: trackIds.size,
        artists: Array.from(artists).slice(0, 2).join(', '),
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 5);
}

export async function fetchSpotifyIdentityBundle(accessToken) {
  const oldest120d = Date.now() - 120 * 24 * 60 * 60 * 1000;

  const [me, topArtistsGenreSeed, topTracksSeed, historyItems] = await Promise.all([
    spotifyGet('/me', accessToken),
    spotifyGet('/me/top/artists?limit=10&time_range=short_term', accessToken),
    spotifyGet('/me/top/tracks?limit=10&time_range=short_term', accessToken),
    fetchRecentlyPlayedSince(accessToken, oldest120d),
  ]);

  const genreCount = {};

  const seedArtists = topArtistsGenreSeed?.items || [];
  // Primary: use Spotify “top artists” genre metadata.
  for (const a of seedArtists) {
    for (const g of a?.genres || []) {
      const gg = String(g || '').trim();
      if (!gg) continue;
      genreCount[gg] = (genreCount[gg] || 0) + 1;
    }
  }

  // Fallback: if Spotify provides no usable genre metadata for the artist seed,
  // derive genres from the artists embedded in top tracks.
  if (Object.keys(genreCount).length === 0) {
    const seedTracks = topTracksSeed?.items || [];
    for (const t of seedTracks) {
      for (const a of t?.artists || []) {
        for (const g of a?.genres || []) {
          const gg = String(g || '').trim();
          if (!gg) continue;
          genreCount[gg] = (genreCount[gg] || 0) + 1;
        }
      }
    }
  }

  const genres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([g]) => g);

  const images = me.images || [];
  const imageUrl = images[0]?.url || null;

  const playStatsByWindow = {};
  for (const days of LISTENING_HISTORY_DAYS) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const windowItems = historyItems.filter((it) => new Date(it.played_at).getTime() >= cutoff);
    playStatsByWindow[String(days)] = buildPlayStatsFromHistory(windowItems);
  }

  const defaultWindow = playStatsByWindow['30'];
  const recentlyPlayed = historyItems.slice(0, 15).map((item) => ({
    playedAt: item.played_at,
    track: mapApiTrackToShape(item.track),
  }));

  return {
    spotifyUserId: me.id,
    displayName: me.display_name || me.id,
    email: me.email || null,
    imageUrl,
    topArtists: defaultWindow.topArtists,
    topTracks: defaultWindow.topTracks,
    albumRankings: defaultWindow.albumRankings,
    epRankings: defaultWindow.epRankings,
    singleRankings: defaultWindow.singleRankings,
    playStatsByWindow,
    genres,
    recentlyPlayed,
    rawMe: me,
  };
}

export { LISTENING_HISTORY_DAYS };

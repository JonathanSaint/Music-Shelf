const API = 'https://api.spotify.com/v1';

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

export async function fetchSpotifyIdentityBundle(accessToken) {
  const [me, topArtists, topTracks, recent] = await Promise.all([
    spotifyGet('/me', accessToken),
    spotifyGet('/me/top/artists?limit=10&time_range=short_term', accessToken),
    spotifyGet('/me/top/tracks?limit=10&time_range=short_term', accessToken),
    spotifyGet('/me/player/recently-played?limit=10', accessToken),
  ]);

  const genreCount = {};
  (topArtists.items || []).forEach((a) => {
    (a.genres || []).forEach((g) => {
      genreCount[g] = (genreCount[g] || 0) + 1;
    });
  });
  const genres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([g]) => g);

  const images = me.images || [];
  const imageUrl = images[0]?.url || null;

  return {
    spotifyUserId: me.id,
    displayName: me.display_name || me.id,
    email: me.email || null,
    imageUrl,
    topArtists: (topArtists.items || []).map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.images?.[0]?.url || null,
      genres: a.genres || [],
    })),
    topTracks: (topTracks.items || []).map((t) => ({
      id: t.id,
      name: t.name,
      previewUrl: t.preview_url || null,
      artists: (t.artists || []).map((x) => ({ id: x.id, name: x.name })),
      albumName: t.album?.name || '',
      imageUrl: t.album?.images?.[0]?.url || null,
    })),
    genres,
    recentlyPlayed: (recent.items || []).map((item) => ({
      playedAt: item.played_at,
      track: {
        id: item.track?.id,
        name: item.track?.name,
        artists: (item.track?.artists || []).map((x) => ({ name: x.name })),
        imageUrl: item.track?.album?.images?.[0]?.url || null,
      },
    })),
    rawMe: me,
  };
}

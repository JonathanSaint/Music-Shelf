const GEMINI_MODEL = 'gemini-2.5-flash';

function send(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.status(status).json(body);
}

function compactTrack(track) {
  return {
    name: track?.name || '',
    artists: (track?.artists || []).map((artist) => artist.name).filter(Boolean),
    albumName: track?.albumName || '',
    durationMs: track?.durationMs || 0,
    rankChange: track?.rankChange || 0,
    playCount: track?.playCount ?? track?.score ?? 0,
  };
}

function compactRelease(release) {
  return {
    name: release?.name || '',
    artists: release?.artists || '',
    score: release?.score || 0,
    tracks: release?.tracks || 0,
    rankChange: release?.rankChange || 0,
  };
}

function compactRecent(item) {
  return {
    playedAt: item?.playedAt || '',
    name: item?.track?.name || '',
    artists: (item?.track?.artists || []).map((artist) => artist.name).filter(Boolean),
    albumName: item?.track?.albumName || '',
    durationMs: item?.track?.durationMs || 0,
  };
}

function buildMusicSnapshot(spotify = {}) {
  return {
    genres: (spotify.genres || []).slice(0, 10),
    topTracks: (spotify.topTracks || []).slice(0, 10).map(compactTrack),
    topArtists: (spotify.topArtists || []).slice(0, 8).map((artist) => ({
      name: artist?.name || '',
      genres: (artist?.genres || []).slice(0, 4),
      playCount: artist?.playCount ?? artist?.score ?? 0,
    })),
    albumRankings: (spotify.albumRankings || []).slice(0, 5).map(compactRelease),
    epRankings: (spotify.epRankings || []).slice(0, 5).map(compactRelease),
    singleRankings: (spotify.singleRankings || []).slice(0, 5).map(compactRelease),
    recentlyPlayed: (spotify.recentlyPlayed || []).slice(0, 20).map(compactRecent),
  };
}

async function verifyFirebaseToken(idToken) {
  const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!firebaseApiKey) throw new Error('Missing FIREBASE_WEB_API_KEY');

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await response.json();
  if (!response.ok || !data.users?.[0]?.localId) return null;
  return data.users[0];
}

function insightSchemaPrompt() {
  return `Return valid JSON only with this exact shape:
{
  "mood": "short mood label",
  "confidence": 0-100,
  "storyTitle": "short story title",
  "story": "warm 1-2 sentence listening story",
  "color": "hex color",
  "tags": ["3", "to", "5", "short", "tags"],
  "songInsight": "one sentence about top songs",
  "albumInsight": "one sentence about albums, EPs, or singles"
}`;
}

function parseGeminiJson(text) {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return send(res, 500, { error: 'Missing GEMINI_API_KEY on Vercel.' });

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return send(res, 401, { error: 'Missing Firebase ID token.' });

  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(idToken);
  } catch {
    return send(res, 500, { error: 'Could not verify Firebase token.' });
  }
  if (!firebaseUser) return send(res, 401, { error: 'Invalid Firebase ID token.' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  } catch {
    return send(res, 400, { error: 'Invalid JSON body.' });
  }
  const spotify = body?.spotify;
  if (!spotify?.topTracks?.length) {
    return send(res, 400, { error: 'Refresh Spotify before generating music insights.' });
  }

  const snapshot = buildMusicSnapshot(spotify);
  const prompt = [
    'You are Music Shelf, a tasteful music companion.',
    'Analyze only the supplied listening snapshot. Do not invent play counts, hours, biographies, release dates, or facts that are not present.',
    insightSchemaPrompt(),
    `Listening snapshot: ${JSON.stringify(snapshot)}`,
  ].join('\n\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    return send(res, response.status, { error: data.error?.message || 'Gemini request failed.' });
  }

  try {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const insight = parseGeminiJson(text);
    return send(res, 200, {
      insight: {
        ...insight,
        provider: 'gemini',
        model: GEMINI_MODEL,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch {
    return send(res, 502, { error: 'Gemini returned an unreadable insight.' });
  }
}

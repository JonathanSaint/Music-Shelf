const GEMINI_MODEL = 'gemini-2.5-flash';

function send(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.status(status).json(body);
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

function enrichmentSchemaPrompt() {
  return `Return valid JSON only with this exact shape:
{
  "summary": "2 sentences about the song's style and mood (no verbatim lyrics).",
  "themes": ["short theme", "another theme"],
  "moodTags": ["3-6 short tags"],
  "releaseContext": "One sentence tying the supplied release date (if any) to era or context; if no date was given, say something general and avoid fake dates.",
  "listeningNote": "One friendly line for a music app (no lyrics).",
  "facts": ["Up to 4 short, widely known notes; use an empty array if unsure."]
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
  const track = body?.track;
  if (!track?.name || typeof track.name !== 'string') {
    return send(res, 400, { error: 'Missing track.name.' });
  }

  const artists = Array.isArray(track.artists) ? track.artists : [];
  const payload = {
    name: track.name,
    artists,
    albumName: track.albumName || '',
    albumReleaseDate: track.albumReleaseDate || '',
    durationMs: track.durationMs || 0,
  };

  const prompt = [
    'You help the Music Shelf app describe songs for listeners.',
    'Do not output song lyrics or long quotations from recordings (copyright). Paraphrase style and themes only.',
    'Do not invent chart positions, awards, or exact release dates — use only the metadata supplied for dates.',
    enrichmentSchemaPrompt(),
    `Track metadata: ${JSON.stringify(payload)}`,
  ].join('\n\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.55,
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
    const enrichment = parseGeminiJson(text);
    return send(res, 200, {
      enrichment: {
        ...enrichment,
        provider: 'gemini',
        model: GEMINI_MODEL,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch {
    return send(res, 502, { error: 'Gemini returned unreadable enrichment.' });
  }
}

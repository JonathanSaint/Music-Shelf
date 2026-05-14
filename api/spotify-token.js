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

const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

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

  const grantType = body.grant_type;
  let params;

  if (grantType === 'authorization_code') {
    if (!body.code || !body.redirect_uri || !body.client_id || !body.code_verifier) {
      return send(res, 400, { error: 'Missing PKCE exchange fields.' });
    }
    params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: body.code,
      redirect_uri: body.redirect_uri,
      client_id: body.client_id,
      code_verifier: body.code_verifier,
    });
  } else if (grantType === 'refresh_token') {
    if (!body.refresh_token || !body.client_id) {
      return send(res, 400, { error: 'Missing refresh_token or client_id.' });
    }
    params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: body.refresh_token,
      client_id: body.client_id,
    });
  } else {
    return send(res, 400, { error: 'Invalid or missing grant_type.' });
  }

  const spotifyRes = await fetch(SPOTIFY_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const json = await spotifyRes.json().catch(() => ({}));
  if (!spotifyRes.ok) {
    return send(res, spotifyRes.status, {
      error: json.error_description || json.error || `Spotify token error (${spotifyRes.status})`,
    });
  }

  return send(res, 200, json);
}

import { auth } from '../lib/firebase';

const apiBaseUrl = process.env.EXPO_PUBLIC_AI_API_BASE_URL || '';

function enrichmentUrl() {
  const base = String(apiBaseUrl || '').replace(/\/$/, '');
  return `${base}/api/track-enrichment`;
}

export async function fetchTrackEnrichment(track) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in before loading track info.');

  const url = enrichmentUrl();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ track }),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      response.ok
        ? 'Track info API returned invalid JSON.'
        : `Track info request failed (${response.status}). Check EXPO_PUBLIC_AI_API_BASE_URL and deploy /api/track-enrichment.`
    );
  }
  if (!response.ok) throw new Error(data.error || 'Could not load track info.');
  return data.enrichment || null;
}

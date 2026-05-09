import { auth } from '../lib/firebase';

const apiBaseUrl = process.env.EXPO_PUBLIC_AI_API_BASE_URL || '';

function insightUrl() {
  return `${apiBaseUrl}/api/generate-music-insight`;
}

export async function generateMusicInsight(spotify) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in before generating music insights.');

  const response = await fetch(insightUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ spotify }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not generate music insight.');
  return data.insight || null;
}

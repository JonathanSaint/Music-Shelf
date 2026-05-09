import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

initializeApp();

const geminiApiKey = defineSecret('GEMINI_API_KEY');

function compactTrack(track) {
  return {
    name: track?.name || '',
    artists: (track?.artists || []).map((artist) => artist.name).filter(Boolean),
    albumName: track?.albumName || '',
    durationMs: track?.durationMs || 0,
    rankChange: track?.rankChange || 0,
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
    })),
    albumRankings: (spotify.albumRankings || []).slice(0, 5).map(compactRelease),
    epRankings: (spotify.epRankings || []).slice(0, 5).map(compactRelease),
    singleRankings: (spotify.singleRankings || []).slice(0, 5).map(compactRelease),
    recentlyPlayed: (spotify.recentlyPlayed || []).slice(0, 20).map(compactRecent),
  };
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    mood: {
      type: Type.STRING,
      description: 'A short mood label, such as Reflective, Bright, Calm, Focused, or After-hours.',
    },
    confidence: {
      type: Type.INTEGER,
      description: 'Confidence from 0 to 100.',
    },
    storyTitle: {
      type: Type.STRING,
      description: 'A short title for the listening story.',
    },
    story: {
      type: Type.STRING,
      description: 'A warm 1-2 sentence story based only on the supplied listening stats.',
    },
    color: {
      type: Type.STRING,
      description: 'A hex color that matches the mood.',
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Three to five concise mood tags.',
    },
    songInsight: {
      type: Type.STRING,
      description: 'One sentence about the top song pattern.',
    },
    albumInsight: {
      type: Type.STRING,
      description: 'One sentence about the strongest album, EP, or single pattern.',
    },
  },
  required: ['mood', 'confidence', 'storyTitle', 'story', 'color', 'tags', 'songInsight', 'albumInsight'],
};

export const generateMusicInsight = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in before generating music insights.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(request.auth.uid);
  const userSnap = await userRef.get();
  const spotify = userSnap.data()?.spotify;

  if (!spotify?.topTracks?.length) {
    throw new HttpsError('failed-precondition', 'Refresh Spotify before generating music insights.');
  }

  const apiKey = geminiApiKey.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Missing GEMINI_API_KEY secret.');
  }

  const snapshot = buildMusicSnapshot(spotify);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      'You are Music Shelf, a tasteful music companion. Analyze the listening snapshot and return only JSON matching the schema.',
      'Do not invent play counts, hours, biographies, release dates, or facts that are not present in the snapshot.',
      `Listening snapshot: ${JSON.stringify(snapshot)}`,
    ].join('\n\n'),
    config: {
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  let insight;
  try {
    insight = JSON.parse(response.text);
  } catch {
    throw new HttpsError('internal', 'Gemini returned an unreadable insight.');
  }

  const savedInsight = {
    ...insight,
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    generatedAt: FieldValue.serverTimestamp(),
  };

  await userRef.set(
    {
      spotify: {
        aiInsight: savedInsight,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { insight };
});

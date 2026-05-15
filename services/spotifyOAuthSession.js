import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'music_shelf_spotify_oauth_pending';

/**
 * Persists PKCE + user context across Spotify's redirect (required on web).
 */
export async function savePendingOAuthSession(payload) {
  const json = JSON.stringify({ ...payload, savedAt: Date.now() });
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, json);
  }
  await AsyncStorage.setItem(STORAGE_KEY, json);
}

export async function loadPendingOAuthSession() {
  let raw = null;
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    raw = sessionStorage.getItem(STORAGE_KEY);
  }
  if (!raw) {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Expire after 15 minutes
    if (parsed.savedAt && Date.now() - parsed.savedAt > 15 * 60 * 1000) {
      await clearPendingOAuthSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingOAuthSession() {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

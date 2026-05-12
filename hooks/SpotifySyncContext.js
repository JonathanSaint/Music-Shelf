import React from 'react';
import { AppState, Platform } from 'react-native';
import { syncSpotifyProfileToFirestore } from '../services/spotifyFirestore';

const SpotifySyncContext = React.createContext({
  syncTick: 0,
});

export function useSpotifySyncTick() {
  const ctx = React.useContext(SpotifySyncContext);
  return ctx?.syncTick ?? 0;
}

/** Background Spotify → Firestore sync on mount, every 10 minutes, and when the app tab / page becomes active again. */
export function SpotifySyncProvider({ uid, email, children }) {
  const [syncTick, setSyncTick] = React.useState(0);
  const lastRunRef = React.useRef(0);

  const runBackgroundSync = React.useCallback(
    async (reason) => {
      if (!uid) return;
      const now = Date.now();
      if (reason !== 'interval' && reason !== 'mount') {
        if (now - lastRunRef.current < 45_000) return;
      }
      lastRunRef.current = now;
      try {
        await syncSpotifyProfileToFirestore(uid, email);
        setSyncTick((t) => t + 1);
      } catch (e) {
        const msg = e?.message || '';
        if (!/No Spotify session/i.test(msg)) {
          console.warn('Spotify auto-sync:', msg);
        }
      }
    },
    [uid, email]
  );

  React.useEffect(() => {
    runBackgroundSync('mount');
  }, [runBackgroundSync]);

  React.useEffect(() => {
    const id = setInterval(() => {
      runBackgroundSync('interval');
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [runBackgroundSync]);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runBackgroundSync('appstate');
    });
    return () => sub.remove();
  }, [runBackgroundSync]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    if (typeof document === 'undefined') return undefined;
    const onVis = () => {
      if (document.visibilityState === 'visible') runBackgroundSync('visibility');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [runBackgroundSync]);

  const value = React.useMemo(() => ({ syncTick }), [syncTick]);

  return <SpotifySyncContext.Provider value={value}>{children}</SpotifySyncContext.Provider>;
}

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBumpSpotifySync } from '../hooks/SpotifySyncContext';
import { useAuth } from '../hooks/useAuth';
import { completeSpotifyOAuthFromCallback, mapSpotifyOAuthError } from '../services/spotifyOAuthComplete';

const BG = '#0B0F14';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';
const GREEN = '#1DB954';
const RED = '#FF6B6B';

export default function SpotifyCallbackScreen() {
  const { user, loading: authLoading } = useAuth();
  const bumpSync = useBumpSpotifySync();
  const [status, setStatus] = React.useState('working');
  const [message, setMessage] = React.useState('Finishing Spotify connection…');
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (authLoading || ranRef.current) return;
    if (!user?.uid) {
      setStatus('error');
      setMessage('Sign in to Music Shelf first, then connect Spotify from Profile.');
      return;
    }

    ranRef.current = true;

    (async () => {
      try {
        const result = await completeSpotifyOAuthFromCallback();
        if (result.status === 'no_code') {
          setStatus('error');
          setMessage('No authorization code received from Spotify. Try connecting again from Profile.');
          return;
        }
        setStatus('success');
        setMessage('Spotify connected! Redirecting…');
        bumpSync();
        setTimeout(() => router.replace('/(tabs)/profile'), 900);
      } catch (e) {
        setStatus('error');
        setMessage(mapSpotifyOAuthError(e?.message || String(e)));
      }
    })();
  }, [authLoading, user?.uid, bumpSync]);

  return (
    <View style={styles.root}>
      {status === 'working' ? (
        <ActivityIndicator color={GREEN} size="large" />
      ) : (
        <Ionicons
          name={status === 'success' ? 'checkmark-circle' : 'alert-circle'}
          size={48}
          color={status === 'success' ? GREEN : RED}
        />
      )}
      <Text style={styles.title}>
        {status === 'success' ? 'Connected' : status === 'error' ? 'Connection failed' : 'Connecting Spotify'}
      </Text>
      <Text style={styles.muted}>{message}</Text>
      {status === 'error' && (
        <Pressable onPress={() => router.replace('/(tabs)/profile')} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
          <Text style={styles.btnText}>Back to Profile</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: BG,
  },
  title: { color: TXT, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  muted: { color: MUTED, textAlign: 'center', lineHeight: 22, maxWidth: 360 },
  btn: {
    marginTop: 8,
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  btnText: { color: '#06110A', fontWeight: '800' },
  pressed: { opacity: 0.85 },
});

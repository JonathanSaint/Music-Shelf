import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

const BG = '#0B0F14';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';
const GREEN = '#1DB954';

export default function SpotifyCallbackScreen() {
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/(tabs)/profile');
    }, 1200);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={GREEN} />
      <Text style={styles.title}>Returning to Music Shelf</Text>
      <Text style={styles.muted}>You can close this tab if the app is already open.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    backgroundColor: BG,
  },
  title: { color: TXT, fontSize: 18, fontWeight: '800' },
  muted: { color: MUTED, textAlign: 'center' },
});

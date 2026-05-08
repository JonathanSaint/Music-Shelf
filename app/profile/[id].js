import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>Public profile for</Text>
        <Text style={styles.value}>{String(id || '')}</Text>
        <Text style={styles.muted}>Next: load user + Spotify stats from Firestore.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0F14', padding: 16, gap: 12 },
  h1: { color: '#E6EDF3', fontSize: 22, fontWeight: '800' },
  card: { backgroundColor: '#111826', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1F2A3A', gap: 6 },
  muted: { color: '#9AA4B2' },
  value: { color: '#E6EDF3', fontSize: 18, fontWeight: '800' },
});


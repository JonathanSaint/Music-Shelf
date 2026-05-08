import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';

export default function HomeTab() {
  const { user } = useAuth();

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Feed</Text>
      <View style={styles.card}>
        <Text style={styles.p}>Placeholder feed for MVP.</Text>
        <Text style={styles.muted}>Signed in as {user?.email || 'unknown'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0F14', padding: 16, gap: 12 },
  h1: { color: '#E6EDF3', fontSize: 22, fontWeight: '800' },
  card: { backgroundColor: '#111826', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1F2A3A', gap: 6 },
  p: { color: '#E6EDF3' },
  muted: { color: '#9AA4B2' },
});


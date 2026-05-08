import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { router } from 'expo-router';

export default function ProfileTab() {
  const { user } = useAuth();

  async function doLogout() {
    await signOut(auth);
    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Your Profile</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || '—'}</Text>
        <Text style={styles.muted}>Spotify identity data will appear here after OAuth.</Text>
      </View>

      <Pressable onPress={() => router.push('/profile/demo')} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Text style={styles.secondaryText}>View public profile route</Text>
      </Pressable>

      <Pressable onPress={doLogout} style={({ pressed }) => [styles.danger, pressed && styles.pressed]}>
        <Text style={styles.dangerText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0F14', padding: 16, gap: 12 },
  h1: { color: '#E6EDF3', fontSize: 22, fontWeight: '800' },
  card: { backgroundColor: '#111826', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1F2A3A', gap: 8 },
  label: { color: '#9AA4B2', fontSize: 12 },
  value: { color: '#E6EDF3', fontSize: 16, fontWeight: '700' },
  muted: { color: '#9AA4B2' },
  secondary: { borderRadius: 999, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1F2A3A' },
  secondaryText: { color: '#E6EDF3', fontWeight: '700' },
  danger: { backgroundColor: '#2A0F14', borderRadius: 999, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#5B1A24' },
  dangerText: { color: '#FF6B6B', fontWeight: '800' },
  pressed: { opacity: 0.85 },
});


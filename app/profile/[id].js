import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { getPublicProfile } from '../../services/spotifyFirestore';

const BG = '#0B0F14';
const CARD = '#111826';
const BORDER = '#1F2A3A';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams();
  const uid = String(id || '');
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getPublicProfile(uid);
        if (!cancelled) setProfile(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const spotify = profile?.spotify;

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="#1DB954" />
      </View>
    );
  }

  if (!spotify) {
    return (
      <View style={styles.root}>
        <Text style={styles.h1}>Profile</Text>
        <Text style={styles.muted}>No public Spotify data for this user yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{spotify.displayName}</Text>

      <View style={styles.hero}>
        {spotify.imageUrl ? (
          <Image source={{ uri: spotify.imageUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]} />
        )}
      </View>

      {!!spotify.genres?.length && (
        <View style={styles.card}>
          <Text style={styles.section}>Genres</Text>
          <Text style={styles.body}>{spotify.genres.join(' · ')}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.section}>Top artists</Text>
        {(spotify.topArtists || []).map((a) => (
          <Text key={a.id} style={styles.line}>
            {a.name}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Top tracks</Text>
        {(spotify.topTracks || []).map((t) => (
          <Text key={t.id} style={styles.line}>
            {t.name}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  h1: { color: TXT, fontSize: 22, fontWeight: '800' },
  muted: { color: MUTED },
  hero: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { backgroundColor: '#243246' },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  section: { color: TXT, fontWeight: '800' },
  body: { color: TXT },
  line: { color: TXT },
});

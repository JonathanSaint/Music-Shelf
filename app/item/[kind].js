import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { getPublicProfile } from '../../services/spotifyFirestore';

const BG = '#080B10';
const PANEL = '#101722';
const BORDER = '#263142';
const TXT = '#F2F6FA';
const MUTED = '#9AA4B2';
const GREEN = '#69E58D';
const BLUE = '#7AA7FF';
const PINK = '#FF7AB6';
const GOLD = '#FFD166';

function artistLine(item) {
  return (item?.artists || []).map((x) => x.name || x).join(', ') || item?.artists || 'Unknown artist';
}

function releaseList(spotify, kind) {
  if (kind === 'artist') return spotify?.topArtists || [];
  if (kind === 'album') return spotify?.albumRankings || [];
  if (kind === 'ep') return spotify?.epRankings || [];
  if (kind === 'single') return spotify?.singleRankings || [];
  return spotify?.topTracks || [];
}

function matches(kind, target, recentItem) {
  const track = recentItem?.track;
  if (!track || !target) return false;
  if (kind === 'song') return (track.id && track.id === target.id) || track.name === target.name;
  if (kind === 'artist') return (track.artists || []).some((artist) => artist.name === target.name);
  return (track.albumId && track.albumId === target.id) || track.albumName === target.name;
}

function formatTime(playedAt) {
  if (!playedAt) return 'Unknown time';
  return new Date(playedAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function ItemStats() {
  const { user } = useAuth();
  const { kind, id } = useLocalSearchParams();
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      try {
        const data = await getPublicProfile(user.uid);
        if (!cancelled) setProfile(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const spotify = profile?.spotify;
  const decodedId = typeof id === 'string' ? id : '';
  const items = releaseList(spotify, kind);
  const item = items.find((entry) => entry.id === decodedId || entry.name === decodedId);
  const recentMatches = (spotify?.recentlyPlayed || []).filter((recentItem) => matches(kind, item, recentItem));
  const minutes = Math.round(recentMatches.reduce((sum, recentItem) => sum + Number(recentItem.track?.durationMs || 0), 0) / 60000);
  const rank = items.findIndex((entry) => entry.id === item?.id || entry.name === item?.name) + 1;
  const title = kind === 'song' ? 'Song stats' : kind === 'artist' ? 'Artist signal' : `${String(kind || 'Release').toUpperCase()} stats`;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" color={TXT} size={20} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 24 }} />
      ) : !item ? (
        <View style={styles.panel}>
          <Ionicons name="stats-chart-outline" color={GREEN} size={28} />
          <Text style={styles.emptyTitle}>Stats not found</Text>
          <Text style={styles.emptyText}>Refresh Spotify, then open this item again.</Text>
        </View>
      ) : (
        <>
          {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.art} /> : <View style={[styles.art, styles.fallback]} />}
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{title}</Text>
            <Text style={styles.h1}>{item.name}</Text>
            <Text style={styles.subtitle}>{kind === 'song' ? artistLine(item) : kind === 'artist' ? (item.genres || []).slice(0, 3).join(', ') || 'Artist' : item.artists || 'Release'}</Text>
          </View>

          <View style={styles.tileGrid}>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>#{rank || '-'}</Text>
              <Text style={styles.tileLabel}>current rank</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{recentMatches.length}</Text>
              <Text style={styles.tileLabel}>recent plays</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{minutes}</Text>
              <Text style={styles.tileLabel}>minutes</Text>
            </View>
          </View>

          {kind === 'artist' && (
            <View style={styles.panel}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Artist identity</Text>
                <Text style={styles.sectionMeta}>spotify</Text>
              </View>
              <Text style={styles.body}>
                {item.name} sits at #{rank || '-'} in your current artist signals with {(item.genres || []).slice(0, 4).join(', ') || 'a mixed genre profile'}.
              </Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailPill}>
                  <Text style={styles.detailValue}>{item.popularity || 0}</Text>
                  <Text style={styles.detailLabel}>popularity</Text>
                </View>
                <View style={styles.detailPill}>
                  <Text style={styles.detailValue}>{item.followers ? item.followers.toLocaleString() : '-'}</Text>
                  <Text style={styles.detailLabel}>followers</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Listening pattern</Text>
              <Text style={styles.sectionMeta}>recent</Text>
            </View>
            <Text style={styles.body}>
              {recentMatches.length
                ? `This ${kind} appears ${recentMatches.length} time${recentMatches.length === 1 ? '' : 's'} in your recent Spotify activity.`
                : `This ${kind} is ranked from your top tracks, but it has not appeared in the recent-play window yet.`}
            </Text>
          </View>

          {!!recentMatches.length && (
            <View style={styles.panel}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent plays</Text>
                <Text style={styles.sectionMeta}>times</Text>
              </View>
              {recentMatches.map((recentItem, index) => (
                <View key={`${recentItem.playedAt}-${index}`} style={styles.playRow}>
                  <Ionicons name="time-outline" color={BLUE} size={18} />
                  <Text style={styles.playText}>{formatTime(recentItem.playedAt)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 36, gap: 16 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  backText: { color: TXT, fontWeight: '900' },
  art: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#263142' },
  fallback: { backgroundColor: '#263142' },
  header: { gap: 5 },
  eyebrow: { color: GREEN, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  h1: { color: TXT, fontSize: 28, lineHeight: 32, fontWeight: '900' },
  subtitle: { color: MUTED, fontWeight: '800' },
  tileGrid: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, minHeight: 88, backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 12, justifyContent: 'space-between' },
  tileValue: { color: TXT, fontSize: 24, fontWeight: '900' },
  tileLabel: { color: MUTED, fontSize: 12, fontWeight: '800' },
  panel: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: TXT, fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: MUTED, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  body: { color: TXT, lineHeight: 21, fontWeight: '700' },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  playText: { color: TXT, fontWeight: '800' },
  detailGrid: { flexDirection: 'row', gap: 10 },
  detailPill: { flex: 1, backgroundColor: '#151D2A', borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, gap: 3 },
  detailValue: { color: TXT, fontSize: 18, fontWeight: '900' },
  detailLabel: { color: MUTED, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  emptyTitle: { color: TXT, fontSize: 18, fontWeight: '900' },
  emptyText: { color: MUTED, lineHeight: 20 },
  pressed: { opacity: 0.85 },
});

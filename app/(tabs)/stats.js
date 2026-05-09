import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

function countArtists(tracks = []) {
  const counts = new Map();
  tracks.forEach((track) => {
    (track.artists || []).forEach((artist) => counts.set(artist.name, (counts.get(artist.name) || 0) + 1));
  });
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function recentHours(recent = []) {
  const buckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  recent.forEach((item) => {
    const hour = new Date(item.playedAt).getHours();
    if (hour >= 5 && hour < 12) buckets.Morning += 1;
    else if (hour >= 12 && hour < 17) buckets.Afternoon += 1;
    else if (hour >= 17 && hour < 22) buckets.Evening += 1;
    else buckets.Night += 1;
  });
  return Object.entries(buckets).map(([label, value]) => ({ label, value }));
}

function listeningDays(recent = []) {
  const days = new Map();
  recent.forEach((item) => {
    if (!item.playedAt) return;
    const day = new Date(item.playedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const durationMs = Number(item.track?.durationMs || 0);
    days.set(day, (days.get(day) || 0) + durationMs);
  });
  return Array.from(days.entries())
    .map(([label, durationMs]) => ({
      label,
      value: Number((durationMs / 3600000).toFixed(1)),
      minutes: Math.round(durationMs / 60000),
    }))
    .slice(0, 5);
}

function moodStory({ genres = [], recent = [], tracks = [] }) {
  const topGenre = genres[0] || 'mixed genres';
  const nightPlays = recent.filter((item) => {
    const hour = new Date(item.playedAt).getHours();
    return hour >= 22 || hour < 5;
  }).length;
  const topTrack = tracks[0]?.name || 'your repeat tracks';

  if (nightPlays >= 4) return `You have been in a late-night ${topGenre} pocket, circling back to ${topTrack}.`;
  if ((genres || []).some((genre) => /dance|pop|afro|house|club|edm/i.test(genre))) return `Your recent mood reads bright and active, with ${topGenre} carrying most of the motion.`;
  if ((genres || []).some((genre) => /sad|emo|r&b|soul|acoustic|indie/i.test(genre))) return `Your listening has been softer and more reflective, especially around ${topGenre}.`;
  return `Your mood has been balanced, moving through ${topGenre} without one single lane taking over.`;
}

function StatTile({ icon, label, value, color }) {
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} color={color} size={20} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function BarRow({ label, value, max, color = GREEN }) {
  const width = max ? `${Math.max(8, Math.round((value / max) * 100))}%` : '8%';
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text numberOfLines={1} style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function StatsTab() {
  const { user } = useAuth();
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
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
  const tracks = spotify?.topTracks || [];
  const artists = spotify?.topArtists || [];
  const genreRows = (spotify?.genres || []).slice(0, 8).map((genre, index) => ({
    label: genre,
    value: Math.max(1, 8 - index),
  }));
  const topArtistCounts = countArtists(tracks);
  const maxGenre = Math.max(...genreRows.map((x) => x.value), 1);
  const recent = recentHours(spotify?.recentlyPlayed || []);
  const maxRecent = Math.max(...recent.map((x) => x.value), 1);
  const daily = listeningDays(spotify?.recentlyPlayed || []);
  const maxDaily = Math.max(...daily.map((x) => x.value), 1);
  const topGenre = genreRows[0];
  const aiInsight = spotify?.aiInsight;
  const story = aiInsight?.story || moodStory({ genres: spotify?.genres || [], recent: spotify?.recentlyPlayed || [], tracks });

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Stats</Text>
        <Text style={styles.h1}>Your sound profile</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 24 }} />
      ) : !spotify ? (
        <View style={styles.emptyPanel}>
          <Ionicons name="analytics-outline" color={GREEN} size={30} />
          <Text style={styles.emptyTitle}>No stats yet.</Text>
          <Text style={styles.emptyText}>Connect Spotify from your Profile tab to build a fresh music snapshot.</Text>
          <Pressable onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Text style={styles.ctaText}>Connect Spotify</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.tileGrid}>
            <StatTile icon="musical-notes-outline" label="Top songs" value={tracks.length} color={GREEN} />
            <StatTile icon="people-outline" label="Top artists" value={artists.length} color={BLUE} />
            <StatTile icon="radio-outline" label="Recent plays" value={spotify.recentlyPlayed?.length || 0} color={PINK} />
          </View>

          <View style={styles.insightGrid}>
            <View style={styles.insightCard}>
              <Text style={styles.insightLabel}>Top genre</Text>
              <Text numberOfLines={1} style={styles.insightValue}>{topGenre?.label || 'Unknown'}</Text>
              <Text style={styles.insightMeta}>{topGenre ? `${topGenre.value} weighted signals` : 'Refresh Spotify to update'}</Text>
            </View>
            <View style={styles.insightCard}>
              <Text style={styles.insightLabel}>{daily[0]?.label || 'Listening day'}</Text>
              <Text style={styles.insightValue}>{daily[0]?.value || 0}h</Text>
              <Text style={styles.insightMeta}>{daily[0]?.minutes || 0} minutes from recent plays</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{aiInsight?.storyTitle || 'Mood story'}</Text>
              <Text style={styles.sectionMeta}>{aiInsight ? aiInsight.mood : 'live'}</Text>
            </View>
            <Text style={styles.storyText}>{story}</Text>
            {!!aiInsight?.songInsight && <Text style={styles.aiDetail}>{aiInsight.songInsight}</Text>}
            {!!aiInsight?.albumInsight && <Text style={styles.aiDetail}>{aiInsight.albumInsight}</Text>}
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Genre fingerprint</Text>
              <Text style={styles.sectionMeta}>weighted</Text>
            </View>
            {genreRows.map((genre, index) => (
              <BarRow key={genre.label} label={genre.label} value={genre.value} max={maxGenre} color={[GREEN, BLUE, PINK, GOLD][index % 4]} />
            ))}
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Artist pull</Text>
              <Text style={styles.sectionMeta}>track count</Text>
            </View>
            {topArtistCounts.map((artist, index) => (
              <BarRow key={artist.name} label={artist.name} value={artist.count} max={topArtistCounts[0]?.count || 1} color={[BLUE, GREEN, PINK, GOLD][index % 4]} />
            ))}
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent listening clock</Text>
              <Text style={styles.sectionMeta}>last 10</Text>
            </View>
            {recent.map((bucket, index) => (
              <BarRow key={bucket.label} label={bucket.label} value={bucket.value} max={maxRecent} color={[GOLD, GREEN, PINK, BLUE][index]} />
            ))}
          </View>

          {!!daily.length && (
            <View style={styles.panel}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Hours by day</Text>
                <Text style={styles.sectionMeta}>recent</Text>
              </View>
              {daily.map((day, index) => (
                <BarRow key={day.label} label={day.label} value={day.value} max={maxDaily} color={[GREEN, GOLD, BLUE, PINK][index % 4]} />
              ))}
            </View>
          )}

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top artists</Text>
              <Text style={styles.sectionMeta}>short term</Text>
            </View>
            {artists.slice(0, 5).map((artist, index) => (
              <View key={artist.id || artist.name} style={styles.artistRow}>
                <Text style={styles.artistRank}>{index + 1}</Text>
                {artist.imageUrl ? <Image source={{ uri: artist.imageUrl }} style={styles.artistImage} /> : <View style={[styles.artistImage, styles.fallback]} />}
                <View style={styles.artistCopy}>
                  <Text numberOfLines={1} style={styles.artistName}>{artist.name}</Text>
                  <Text numberOfLines={1} style={styles.artistGenres}>{(artist.genres || []).slice(0, 2).join(', ') || 'Artist'}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 36, gap: 16 },
  header: { gap: 4 },
  eyebrow: { color: GREEN, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  h1: { color: TXT, fontSize: 30, lineHeight: 34, fontWeight: '900' },
  tileGrid: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, minHeight: 104, backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 12, justifyContent: 'space-between' },
  tileValue: { color: TXT, fontSize: 26, fontWeight: '900' },
  tileLabel: { color: MUTED, fontSize: 12, fontWeight: '800' },
  insightGrid: { flexDirection: 'row', gap: 10 },
  insightCard: { flex: 1, backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 12, gap: 6 },
  insightLabel: { color: MUTED, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  insightValue: { color: TXT, fontSize: 20, fontWeight: '900' },
  insightMeta: { color: MUTED, fontSize: 12, lineHeight: 16 },
  panel: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 14, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: TXT, fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: MUTED, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  barRow: { gap: 7 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  barLabel: { color: TXT, fontWeight: '800', flex: 1 },
  barValue: { color: MUTED, fontWeight: '900' },
  barTrack: { height: 9, backgroundColor: '#1A2230', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  storyText: { color: TXT, lineHeight: 21, fontWeight: '700' },
  aiDetail: { color: MUTED, lineHeight: 19 },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58 },
  artistRank: { color: GOLD, width: 22, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  artistImage: { width: 48, height: 48, borderRadius: 24 },
  fallback: { backgroundColor: '#263142' },
  artistCopy: { flex: 1, minWidth: 0 },
  artistName: { color: TXT, fontWeight: '900' },
  artistGenres: { color: MUTED, fontSize: 12, marginTop: 2 },
  emptyPanel: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 18, gap: 10 },
  emptyTitle: { color: TXT, fontSize: 18, fontWeight: '900' },
  emptyText: { color: MUTED, lineHeight: 20 },
  cta: { alignSelf: 'flex-start', backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  ctaText: { color: '#07120B', fontWeight: '900' },
  pressed: { opacity: 0.85 },
});

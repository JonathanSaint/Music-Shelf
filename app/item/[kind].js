import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useSpotifySyncTick } from '../../hooks/SpotifySyncContext';
import { getPublicProfile } from '../../services/spotifyFirestore';
import { fetchTrackEnrichment } from '../../services/trackEnrichment';

const BG = '#080B10';
const PANEL = '#101722';
const BORDER = '#263142';
const TXT = '#F2F6FA';
const MUTED = '#9AA4B2';
const GREEN = '#69E58D';
const BLUE = '#7AA7FF';
const PINK = '#FF7AB6';
const GOLD = '#FFD166';
const VIOLET = '#C4B5FD';

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

function formatDurationMs(ms) {
  const n = Number(ms) || 0;
  if (!n) return '—';
  const totalSec = Math.floor(n / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatReleaseDate(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw + 'T12:00:00');
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [y, mo] = raw.split('-');
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  }
  if (/^\d{4}$/.test(raw)) return raw;
  return raw;
}

export default function ItemStats() {
  const { user } = useAuth();
  const syncTick = useSpotifySyncTick();
  const { kind, id } = useLocalSearchParams();
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [enrichment, setEnrichment] = React.useState(null);
  const [enrichmentLoading, setEnrichmentLoading] = React.useState(false);
  const [enrichmentError, setEnrichmentError] = React.useState('');

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
  }, [user?.uid, syncTick]);

  React.useEffect(() => {
    setEnrichment(null);
    setEnrichmentError('');
  }, [kind, id, user?.uid, syncTick]);

  React.useEffect(() => {
    if (kind !== 'song' || !user?.uid || !profile) return undefined;
    const items = releaseList(profile.spotify, kind);
    const decodedId = typeof id === 'string' ? id : '';
    const trackItem = items.find((entry) => entry.id === decodedId || entry.name === decodedId);
    if (!trackItem?.name) return undefined;

    let cancelled = false;
    async function run() {
      setEnrichmentLoading(true);
      setEnrichmentError('');
      try {
        const data = await fetchTrackEnrichment({
          name: trackItem.name,
          artists: (trackItem.artists || []).map((a) => a.name).filter(Boolean),
          albumName: trackItem.albumName || '',
          albumReleaseDate: trackItem.albumReleaseDate || '',
          durationMs: trackItem.durationMs || 0,
        });
        if (!cancelled) setEnrichment(data);
      } catch (e) {
        if (!cancelled) setEnrichmentError(e?.message || 'Could not load AI track info.');
      } finally {
        if (!cancelled) setEnrichmentLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [kind, id, user?.uid, profile]);

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
              <Text style={styles.tileValue}>{item.playCount != null ? item.playCount : recentMatches.length}</Text>
              <Text style={styles.tileLabel}>{item.playCount != null ? 'plays (window)' : 'recent plays'}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{minutes}</Text>
              <Text style={styles.tileLabel}>minutes</Text>
            </View>
          </View>

          {kind === 'song' && (
            <View style={styles.panel}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Release & track</Text>
                <Text style={styles.sectionMeta}>spotify</Text>
              </View>
              <View style={styles.metaGrid}>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>Released</Text>
                  <Text style={styles.metaValue}>{formatReleaseDate(item.albumReleaseDate) || '—'}</Text>
                </View>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaValue}>{formatDurationMs(item.durationMs)}</Text>
                </View>
                <View style={[styles.metaCell, styles.metaCellWide]}>
                  <Text style={styles.metaLabel}>Album</Text>
                  <Text style={styles.metaValue}>{item.albumName || '—'}</Text>
                </View>
              </View>
            </View>
          )}

          {kind === 'song' && (
            <View style={styles.panel}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Story & context</Text>
                <Text style={styles.sectionMeta}>gemini</Text>
              </View>
              {enrichmentLoading ? (
                <ActivityIndicator color={GREEN} style={{ marginVertical: 8 }} />
              ) : enrichmentError ? (
                <Text style={styles.mutedBlock}>{enrichmentError}</Text>
              ) : enrichment ? (
                <>
                  <Text style={styles.body}>{enrichment.summary}</Text>
                  {!!enrichment.releaseContext && (
                    <Text style={styles.bodySecondary}>{enrichment.releaseContext}</Text>
                  )}
                  {!!enrichment.listeningNote && (
                    <View style={styles.noteRow}>
                      <Ionicons name="headset-outline" color={GOLD} size={18} />
                      <Text style={styles.noteText}>{enrichment.listeningNote}</Text>
                    </View>
                  )}
                  {!!enrichment.themes?.length && (
                    <View style={styles.tagWrap}>
                      {(enrichment.themes || []).map((t, i) => (
                        <View key={`theme-${i}-${String(t)}`} style={styles.tag}>
                          <Text style={styles.tagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {!!enrichment.moodTags?.length && (
                    <View style={styles.tagWrap}>
                      {(enrichment.moodTags || []).map((t, i) => (
                        <View key={`mood-${i}-${String(t)}`} style={styles.tagMood}>
                          <Text style={styles.tagMoodText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {!!enrichment.facts?.length && (
                    <View style={styles.factList}>
                      {(enrichment.facts || []).map((fact, i) => (
                        <View key={`${i}-${fact}`} style={styles.factRow}>
                          <Text style={styles.factBullet}>•</Text>
                          <Text style={styles.factText}>{fact}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={styles.aiDisclaimer}>AI-generated descriptions, not official lyrics or liner notes.</Text>
                </>
              ) : null}
            </View>
          )}

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
                  <Text style={styles.detailValue}>{item.playCount != null ? item.playCount : item.popularity || 0}</Text>
                  <Text style={styles.detailLabel}>{item.playCount != null ? 'your plays' : 'popularity'}</Text>
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
  bodySecondary: { color: MUTED, lineHeight: 20, fontWeight: '700', marginTop: 6 },
  mutedBlock: { color: MUTED, lineHeight: 20 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaCell: { flex: 1, minWidth: '42%', backgroundColor: '#151D2A', borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10 },
  metaCellWide: { minWidth: '100%', flexBasis: '100%' },
  metaLabel: { color: MUTED, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  metaValue: { color: TXT, fontSize: 15, fontWeight: '800' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  noteText: { color: GOLD, flex: 1, lineHeight: 20, fontWeight: '700' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: { backgroundColor: '#102516', borderWidth: 1, borderColor: '#285C38', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: GREEN, fontSize: 12, fontWeight: '800' },
  tagMood: { backgroundColor: '#2D2640', borderWidth: 1, borderColor: '#5B4B8A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagMoodText: { color: VIOLET, fontSize: 12, fontWeight: '800' },
  factList: { marginTop: 10, gap: 6 },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  factBullet: { color: BLUE, fontWeight: '900' },
  factText: { color: TXT, flex: 1, lineHeight: 20, fontWeight: '700' },
  aiDisclaimer: { color: MUTED, fontSize: 11, fontStyle: 'italic', marginTop: 12, lineHeight: 16 },
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

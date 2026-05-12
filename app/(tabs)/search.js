import React from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useSpotifySyncTick } from '../../hooks/SpotifySyncContext';
import { getPublicProfile, saveMusicInsight } from '../../services/spotifyFirestore';
import { generateMusicInsight } from '../../services/musicInsight';

const BG = '#080B10';
const PANEL = 'rgba(16, 23, 34, 0.82)';
const PANEL_2 = '#151D2A';
const BORDER = '#263142';
const TXT = '#F2F6FA';
const MUTED = '#9AA4B2';
const GREEN = '#69E58D';
const BLUE = '#7AA7FF';
const PINK = '#FF7AB6';
const GOLD = '#FFD166';

function artistLine(track) {
  return (track?.artists || []).map((x) => x.name).join(', ') || track?.artists || 'Unknown artist';
}

function localAura(spotify = {}) {
  const genres = spotify.genres || [];
  const topGenre = genres[0] || 'mixed signals';
  const topTrack = spotify.topTracks?.[0]?.name || 'your current repeats';
  const topArtist = spotify.topArtists?.[0]?.name || spotify.topTracks?.[0]?.artists?.[0]?.name || 'your core artists';
  const recent = spotify.recentlyPlayed || [];
  const nightPlays = recent.filter((item) => {
    const hour = new Date(item.playedAt).getHours();
    return hour >= 22 || hour < 5;
  }).length;
  const bright = genres.some((genre) => /pop|dance|afro|house|club|edm|rap/i.test(genre));
  const soft = genres.some((genre) => /r&b|soul|indie|acoustic|ambient|sad|emo/i.test(genre));

  if (nightPlays >= 4) {
    return {
      mood: 'Midnight Neon',
      storyTitle: 'After-hours aura',
      story: `Your recent listening glows late at night, with ${topTrack} and ${topGenre} giving the shelf a cinematic edge.`,
      tags: ['late night', 'cinematic', topGenre],
      songInsight: `${topTrack} is acting like the emotional anchor of this run.`,
      albumInsight: `${topArtist} is shaping the atmosphere more than the raw play count suggests.`,
    };
  }
  if (bright) {
    return {
      mood: 'Electric Bloom',
      storyTitle: 'Bright rotation',
      story: `${topGenre} is pushing your taste toward movement and color, while ${topArtist} keeps the identity clear.`,
      tags: ['bright', 'active', topGenre],
      songInsight: `${topTrack} gives this phase its most immediate pulse.`,
      albumInsight: `Your strongest releases lean replayable and high-energy.`,
    };
  }
  if (soft) {
    return {
      mood: 'Cinematic Soul',
      storyTitle: 'Soft focus',
      story: `Your shelf feels reflective right now, led by ${topArtist} and a lot of ${topGenre}.`,
      tags: ['reflective', 'warm', topGenre],
      songInsight: `${topTrack} is carrying the gentler side of your recent mood.`,
      albumInsight: `The release board points toward slower, more immersive listening.`,
    };
  }
  return {
    mood: 'Emotional Explorer',
    storyTitle: 'Open horizon',
    story: `Your listening is spreading across ${topGenre}, with ${topArtist} near the center of your current identity.`,
    tags: ['balanced', 'curious', topGenre],
    songInsight: `${topTrack} is the clearest signal in a broad listening week.`,
    albumInsight: `Your release taste looks varied rather than locked into one lane.`,
  };
}

function compatibilityScores(spotify = {}) {
  const genres = spotify.genres || [];
  const tracks = spotify.topTracks || [];
  const artists = spotify.topArtists || [];
  const experimentalWords = /ambient|alternative|indie|experimental|jazz|psychedelic|electronic/i;
  const emotionalWords = /r&b|soul|emo|sad|acoustic|ambient|indie/i;
  const mainstream = Math.round((artists.reduce((sum, artist) => sum + Number(artist.popularity || 45), 0) / Math.max(artists.length, 1)) || 45);
  const experimental = Math.min(96, 34 + genres.filter((genre) => experimentalWords.test(genre)).length * 14 + tracks.length);
  const emotional = Math.min(98, 38 + genres.filter((genre) => emotionalWords.test(genre)).length * 13 + (spotify.recentlyPlayed?.length || 0));
  const underground = Math.max(8, 100 - mainstream);
  return [
    { label: 'Emotional intensity', value: emotional, color: PINK },
    { label: 'Experimental edge', value: experimental, color: BLUE },
    { label: 'Underground score', value: underground, color: GREEN },
    { label: 'Mainstream pull', value: mainstream, color: GOLD },
  ];
}

function eras(spotify = {}, aura) {
  const genre = spotify.genres?.[0] || 'Mixed Genre';
  const artist = spotify.topArtists?.[0]?.name || 'Core Artist';
  const recent = spotify.recentlyPlayed || [];
  return [
    {
      title: `${genre} Era`,
      body: `Your top genres keep orbiting ${genre}, making it the strongest identity signal right now.`,
    },
    {
      title: `${artist} Phase`,
      body: `${artist} is the artist marker for this snapshot of your taste.`,
    },
    {
      title: aura.mood,
      body: `${recent.length || 0} recent plays help shape this aura into something more personal than a static genre list.`,
    },
  ];
}

function AuraMetric({ label, value, color }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
      </View>
      <View style={styles.metricTrack}>
        <View style={[styles.metricFill, { width: `${Math.max(8, Math.min(value, 100))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MusicCard({ item, kind, subtitle, meta }) {
  return (
    <Pressable
      onPress={() => router.push(`/item/${kind}?id=${encodeURIComponent(item.id || item.name)}`)}
      style={({ pressed }) => [styles.musicCard, pressed && styles.pressed]}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.musicImage} /> : <View style={[styles.musicImage, styles.fallback]} />}
      <View style={styles.musicCopy}>
        <Text numberOfLines={1} style={styles.musicTitle}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.musicSubtitle}>{subtitle}</Text>
      </View>
      {!!meta && <Text style={styles.musicMeta}>{meta}</Text>}
    </Pressable>
  );
}

function SectionHeader({ title, tag }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionTag}>{tag}</Text>
    </View>
  );
}

export default function AuraTab() {
  const { user } = useAuth();
  const syncTick = useSpotifySyncTick();
  const pulse = React.useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadProfile = React.useCallback(async () => {
    if (!user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getPublicProfile(user.uid);
      setProfile(data);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, syncTick]);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  async function refreshAura() {
    if (!user?.uid || !profile?.spotify) return;
    setGenerating(true);
    setError('');
    try {
      const insight = await generateMusicInsight(profile.spotify);
      await saveMusicInsight(user.uid, insight);
      await loadProfile();
    } catch (e) {
      setError(e?.message || 'Could not generate AI aura yet.');
    } finally {
      setGenerating(false);
    }
  }

  const spotify = profile?.spotify;
  const aura = spotify?.aiInsight || localAura(spotify || {});
  const metrics = compatibilityScores(spotify || {});
  const phaseRows = eras(spotify || {}, aura);
  const topTracks = spotify?.topTracks || [];
  const topArtists = spotify?.topArtists || [];
  const releases = [...(spotify?.albumRankings || []), ...(spotify?.epRankings || []), ...(spotify?.singleRankings || [])].slice(0, 5);
  const heroScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const heroOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.58, 0.92] });

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Aura</Text>
          <Text style={styles.h1}>Your music identity</Text>
        </View>
        <Pressable onPress={refreshAura} disabled={!spotify || generating} style={({ pressed }) => [styles.refreshButton, (!spotify || generating) && styles.disabled, pressed && styles.pressed]}>
          {generating ? <ActivityIndicator color="#07120B" /> : <Ionicons name="sparkles-outline" color="#07120B" size={18} />}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 24 }} />
      ) : !spotify ? (
        <View style={styles.emptyPanel}>
          <Ionicons name="planet-outline" color={GREEN} size={30} />
          <Text style={styles.emptyTitle}>No aura yet.</Text>
          <Text style={styles.emptyText}>Connect Spotify from Profile to turn your listening into an AI-powered music identity.</Text>
          <Pressable onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Text style={styles.ctaText}>Connect Spotify</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.auraHero}>
            <Animated.View style={[styles.glowOrb, { opacity: heroOpacity, transform: [{ scale: heroScale }] }]} />
            <View style={styles.heroTopline}>
              <Ionicons name="radio-outline" color={GOLD} size={18} />
              <Text style={styles.heroMeta}>{aura.provider ? 'Gemini aura' : 'Local aura'}</Text>
            </View>
            <Text style={styles.auraName}>{aura.mood || 'Emotional Explorer'}</Text>
            <Text style={styles.auraStory}>{aura.story || aura.storyTitle}</Text>
            <View style={styles.tagRail}>
              {(aura.tags || spotify.genres || []).slice(0, 5).map((tag) => (
                <View key={tag} style={styles.auraTag}>
                  <Text style={styles.auraTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          {!!error && (
            <View style={styles.errorPanel}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.panel}>
            <SectionHeader title="Identity scores" tag="live" />
            {metrics.map((metric) => (
              <AuraMetric key={metric.label} {...metric} />
            ))}
          </View>

          <View style={styles.panel}>
            <SectionHeader title="Daily recap" tag="ai" />
            <Text style={styles.featureText}>{aura.songInsight}</Text>
            <Text style={styles.featureSubtext}>{aura.albumInsight}</Text>
          </View>

          <View style={styles.panel}>
            <SectionHeader title="Music evolution" tag="eras" />
            {phaseRows.map((phase, index) => (
              <View key={phase.title} style={styles.phaseRow}>
                <View style={styles.phaseMarker}>
                  <Text style={styles.phaseNumber}>{index + 1}</Text>
                </View>
                <View style={styles.phaseCopy}>
                  <Text style={styles.phaseTitle}>{phase.title}</Text>
                  <Text style={styles.phaseBody}>{phase.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {!!topTracks.length && (
            <View style={styles.panel}>
              <SectionHeader title="Track deep dives" tag="songs" />
              {topTracks.slice(0, 5).map((track, index) => (
                <MusicCard key={track.id || `${track.name}-${index}`} item={track} kind="song" subtitle={artistLine(track)} meta={`#${index + 1}`} />
              ))}
            </View>
          )}

          {!!releases.length && (
            <View style={styles.panel}>
              <SectionHeader title="Release portals" tag="albums" />
              {releases.map((release, index) => (
                <MusicCard key={release.id || `${release.name}-${index}`} item={release} kind={release.kind || 'album'} subtitle={release.artists || `${release.tracks} tracks`} meta={`${release.score || 0} pts`} />
              ))}
            </View>
          )}

          {!!topArtists.length && (
            <View style={styles.panel}>
              <SectionHeader title="Artist signals" tag="style" />
              {topArtists.slice(0, 5).map((artist, index) => (
                <MusicCard key={artist.id || artist.name} item={artist} kind="artist" subtitle={(artist.genres || []).slice(0, 2).join(', ') || 'Artist'} meta={`#${index + 1}`} />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 },
  eyebrow: { color: GREEN, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  h1: { color: TXT, fontSize: 30, lineHeight: 34, fontWeight: '900' },
  refreshButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  auraHero: { minHeight: 264, backgroundColor: '#111826', borderWidth: 1, borderColor: '#314158', borderRadius: 8, padding: 18, overflow: 'hidden', justifyContent: 'flex-end', gap: 12 },
  glowOrb: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -64, top: -64, backgroundColor: PINK },
  heroTopline: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroMeta: { color: GOLD, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  auraName: { color: TXT, fontSize: 36, lineHeight: 39, fontWeight: '900', maxWidth: 300 },
  auraStory: { color: '#DDE6F2', lineHeight: 22, fontWeight: '700', maxWidth: 330 },
  tagRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  auraTag: { backgroundColor: 'rgba(8, 11, 16, 0.56)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  auraTagText: { color: TXT, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  panel: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 14, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: TXT, fontSize: 18, fontWeight: '900' },
  sectionTag: { color: MUTED, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  metricCard: { gap: 7 },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  metricLabel: { color: TXT, fontWeight: '800', flex: 1 },
  metricValue: { fontWeight: '900' },
  metricTrack: { height: 8, backgroundColor: '#1A2230', borderRadius: 999, overflow: 'hidden' },
  metricFill: { height: '100%', borderRadius: 999 },
  featureText: { color: TXT, lineHeight: 22, fontWeight: '800' },
  featureSubtext: { color: MUTED, lineHeight: 20 },
  phaseRow: { flexDirection: 'row', gap: 10 },
  phaseMarker: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#102516', borderWidth: 1, borderColor: '#285C38', alignItems: 'center', justifyContent: 'center' },
  phaseNumber: { color: GREEN, fontWeight: '900' },
  phaseCopy: { flex: 1, minWidth: 0, gap: 3 },
  phaseTitle: { color: TXT, fontWeight: '900' },
  phaseBody: { color: MUTED, lineHeight: 19 },
  musicCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: '#1A2230', borderRadius: 8, padding: 9 },
  musicImage: { width: 48, height: 48, borderRadius: 6 },
  fallback: { backgroundColor: PANEL_2 },
  musicCopy: { flex: 1, minWidth: 0 },
  musicTitle: { color: TXT, fontSize: 15, fontWeight: '900' },
  musicSubtitle: { color: MUTED, fontSize: 12, marginTop: 3 },
  musicMeta: { color: GOLD, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  emptyPanel: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 18, gap: 10 },
  emptyTitle: { color: TXT, fontSize: 18, fontWeight: '900' },
  emptyText: { color: MUTED, lineHeight: 20 },
  cta: { alignSelf: 'flex-start', backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  ctaText: { color: '#07120B', fontWeight: '900' },
  errorPanel: { backgroundColor: '#2A0F14', borderWidth: 1, borderColor: '#5B1A24', borderRadius: 8, padding: 12 },
  errorText: { color: '#FF9AA8', fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
});

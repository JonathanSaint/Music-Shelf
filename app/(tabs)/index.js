import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useSpotifySyncTick } from '../../hooks/SpotifySyncContext';
import { getPublicProfile } from '../../services/spotifyFirestore';

const BG = '#080B10';
const PANEL = '#101722';
const PANEL_2 = '#151D2A';
const BORDER = '#263142';
const TXT = '#F2F6FA';
const MUTED = '#9AA4B2';
const GREEN = '#69E58D';
const BLUE = '#7AA7FF';
const PINK = '#FF7AB6';
const GOLD = '#FFD166';

function artistLine(track) {
  return (track?.artists || []).map((x) => x.name).join(', ') || track?.albumName || 'Unknown artist';
}

function moodStory({ genres = [], recent = [], tracks = [] }) {
  const topGenre = genres[0] || 'mixed sounds';
  const nightPlays = recent.filter((item) => {
    const hour = new Date(item.playedAt).getHours();
    return hour >= 22 || hour < 5;
  }).length;
  const leadArtist = tracks[0]?.artists?.[0]?.name || 'your repeat artists';
  const leadSong = tracks[0]?.name || 'your top songs';

  if (nightPlays >= 4) {
    return {
      title: 'After-hours loop',
      body: `Your recent plays lean late-night, with ${leadSong} and ${topGenre} setting the mood.`,
    };
  }
  if ((genres || []).some((genre) => /dance|pop|afro|house|club|edm/i.test(genre))) {
    return {
      title: 'Bright rotation',
      body: `${topGenre} is doing the heavy lifting, and ${leadArtist} keeps the energy moving.`,
    };
  }
  if ((genres || []).some((genre) => /sad|emo|r&b|soul|acoustic|indie/i.test(genre))) {
    return {
      title: 'Soft focus',
      body: `Your shelf feels reflective right now, led by ${leadArtist} and a lot of ${topGenre}.`,
    };
  }
  return {
    title: 'Balanced shelf',
    body: `Your listening has been spread across ${topGenre}, with ${leadArtist} near the center.`,
  };
}

function displayStory(spotify, fallbackStory) {
  const insight = spotify?.aiInsight;
  if (!insight?.story) return fallbackStory;
  return {
    title: insight.storyTitle || insight.mood || fallbackStory.title,
    body: insight.story,
  };
}

function getAlbumRankings(topTracks = []) {
  const albums = new Map();
  topTracks.forEach((track, index) => {
    if (!track.albumName) return;
    const totalTracks = Number(track.albumTotalTracks || 0);
    const isAlbum = track.albumType === 'album' || (!track.albumType && (!totalTracks || totalTracks > 6));
    if (!isAlbum) return;
    const id = track.albumId || track.albumName;
    const current = albums.get(id) || {
      id,
      name: track.albumName,
      imageUrl: track.imageUrl,
      score: 0,
      tracks: 0,
      artists: new Set(),
    };
    current.score += Math.max(1, 12 - index);
    current.tracks += 1;
    (track.artists || []).forEach((artist) => current.artists.add(artist.name));
    albums.set(id, current);
  });

  return Array.from(albums.values())
    .map((album) => ({ ...album, artists: Array.from(album.artists).slice(0, 2).join(', ') }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function getReleaseRankings(topTracks = [], kind) {
  const releases = new Map();
  topTracks.forEach((track, index) => {
    if (!track.albumName) return;
    const totalTracks = Number(track.albumTotalTracks || 0);
    if (!track.albumType && !totalTracks) return;
    const releaseKind = totalTracks >= 4 && totalTracks <= 6 ? 'ep' : 'single';
    if (track.albumType === 'album' || releaseKind !== kind) return;
    const id = track.albumId || track.albumName;
    const current = releases.get(id) || {
      id,
      name: track.albumName,
      imageUrl: track.imageUrl,
      score: 0,
      tracks: 0,
      artists: new Set(),
    };
    current.score += Math.max(1, 12 - index);
    current.tracks += 1;
    (track.artists || []).forEach((artist) => current.artists.add(artist.name));
    releases.set(id, current);
  });

  return Array.from(releases.values())
    .map((release) => ({ ...release, artists: Array.from(release.artists).slice(0, 2).join(', ') }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function RankBadge({ rank }) {
  const colors = rank === 1 ? [GOLD, '#392C08'] : rank === 2 ? [BLUE, '#101E3D'] : rank === 3 ? [PINK, '#361326'] : [GREEN, '#102516'];
  return (
    <View style={[styles.rankBadge, { backgroundColor: colors[1], borderColor: colors[0] }]}>
      <Text style={[styles.rankText, { color: colors[0] }]}>#{rank}</Text>
    </View>
  );
}

function RankMovement({ change }) {
  const isUp = change > 0;
  const isDown = change < 0;
  if (!isUp && !isDown) return null;

  return (
    <View style={styles.movementBadge}>
      <Ionicons name={isUp ? 'caret-up' : 'caret-down'} color={isUp ? GREEN : PINK} size={14} />
      <Text style={[styles.movementText, { color: isUp ? GREEN : PINK }]}>{Math.abs(change)}</Text>
    </View>
  );
}

function RankedRow({ item, rank, subtitle, meta, showMovement = false, onPress }) {
  const Row = onPress ? Pressable : View;
  return (
    <Row onPress={onPress} style={onPress ? ({ pressed }) => [styles.rankRow, pressed && styles.pressed] : styles.rankRow}>
      <RankBadge rank={rank} />
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.cover} /> : <View style={[styles.cover, styles.coverFallback]} />}
      <View style={styles.rankCopy}>
        <Text numberOfLines={1} style={styles.rankTitle}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.rankSubtitle}>{subtitle}</Text>
      </View>
      {showMovement && <RankMovement change={item.rankChange} />}
      {!!meta && <Text style={styles.meta}>{meta}</Text>}
    </Row>
  );
}

function ReleaseBoard({ title, tag, releases, kind }) {
  if (!releases.length) return null;
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionTag}>{tag}</Text>
      </View>
      <View style={styles.panel}>
        {releases.map((release, index) => (
          <RankedRow
            key={release.id || `${release.name}-${index}`}
            item={release}
            rank={index + 1}
            subtitle={release.artists || `${release.tracks} tracks`}
            meta={`${release.score} pts`}
            onPress={() => router.push(`/item/${kind}?id=${encodeURIComponent(release.id || release.name)}`)}
          />
        ))}
      </View>
    </>
  );
}

export default function HomeTab() {
  const { user } = useAuth();
  const syncTick = useSpotifySyncTick();
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
  }, [user?.uid, syncTick]);

  const spotify = profile?.spotify;
  const topTracks = spotify?.topTracks || [];
  const albums = spotify?.albumRankings || getAlbumRankings(topTracks);
  const eps = spotify?.epRankings || getReleaseRankings(topTracks, 'ep');
  const singles = spotify?.singleRankings || getReleaseRankings(topTracks, 'single');
  const topGenres = spotify?.genres?.slice(0, 4) || [];
  const story = displayStory(spotify, moodStory({ genres: spotify?.genres || [], recent: spotify?.recentlyPlayed || [], tracks: topTracks }));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.eyebrow}>Music Shelf</Text>
          <Text style={styles.h1}>Your listening leaderboard</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => pressed && styles.pressed}>
          {spotify?.imageUrl ? <Image source={{ uri: spotify.imageUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]} />}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 24 }} />
      ) : !spotify ? (
        <View style={styles.emptyPanel}>
          <Ionicons name="musical-notes-outline" color={GREEN} size={30} />
          <Text style={styles.emptyTitle}>Connect Spotify to unlock your rankings.</Text>
          <Text style={styles.emptyText}>Your top songs, album board, genres, and recent plays will appear here.</Text>
          <Pressable onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Text style={styles.ctaText}>Go to Profile</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.scoreGrid}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreValue}>{topTracks.length}</Text>
              <Text style={styles.scoreLabel}>ranked songs</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreValue}>{albums.length + eps.length + singles.length}</Text>
              <Text style={styles.scoreLabel}>ranked releases</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreValue}>{spotify.genres?.length || 0}</Text>
              <Text style={styles.scoreLabel}>genre signals</Text>
            </View>
          </View>

          {!!topGenres.length && (
            <View style={styles.genreRail}>
              {topGenres.map((genre) => (
                <View key={genre} style={styles.genrePill}>
                  <Text style={styles.genreText}>{genre}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable onPress={() => router.push('/(tabs)/stats')} style={({ pressed }) => [styles.storyPanel, pressed && styles.pressed]}>
            <View style={styles.storyIcon}>
              <Ionicons name="sparkles-outline" color={GOLD} size={18} />
            </View>
            <View style={styles.storyCopy}>
              <Text style={styles.storyTitle}>{story.title}</Text>
              <Text style={styles.storyText}>{story.body}</Text>
              {!!spotify?.aiInsight?.tags?.length && (
                <Text numberOfLines={1} style={styles.storyTags}>{spotify.aiInsight.tags.slice(0, 4).join(' / ')}</Text>
              )}
            </View>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top songs</Text>
            <Text style={styles.sectionTag}>short term</Text>
          </View>
          <View style={styles.panel}>
            {topTracks.slice(0, 5).map((track, index) => (
              <RankedRow
                key={track.id || `${track.name}-${index}`}
                item={track}
                rank={index + 1}
                subtitle={artistLine(track)}
                meta={index === 0 ? 'crown' : null}
                showMovement
                onPress={() => router.push(`/item/song?id=${encodeURIComponent(track.id || track.name)}`)}
              />
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Album board</Text>
            <Text style={styles.sectionTag}>from top tracks</Text>
          </View>
          <View style={styles.albumGrid}>
            {albums.map((album, index) => (
              <Pressable
                key={album.id}
                onPress={() => router.push(`/item/album?id=${encodeURIComponent(album.id || album.name)}`)}
                style={({ pressed }) => [styles.albumCard, pressed && styles.pressed]}>
                <View style={styles.albumCardTop}>
                  <RankBadge rank={index + 1} />
                  <RankMovement change={album.rankChange} />
                </View>
                {album.imageUrl ? <Image source={{ uri: album.imageUrl }} style={styles.albumArt} /> : <View style={[styles.albumArt, styles.coverFallback]} />}
                <Text numberOfLines={2} style={styles.albumName}>{album.name}</Text>
                <Text numberOfLines={1} style={styles.albumArtist}>{album.artists || `${album.tracks} tracks`}</Text>
              </Pressable>
            ))}
          </View>

          <ReleaseBoard title="Top EPs" tag="from top tracks" releases={eps} kind="ep" />
          <ReleaseBoard title="Top singles" tag="from top tracks" releases={singles} kind="single" />

          <Text style={styles.creator}>Created by Jonathan Arinda</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 36, gap: 16 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, paddingTop: 4 },
  eyebrow: { color: GREEN, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  h1: { color: TXT, fontSize: 30, lineHeight: 34, fontWeight: '900', maxWidth: 280 },
  avatar: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: GREEN },
  avatarFallback: { backgroundColor: PANEL_2 },
  emptyPanel: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 18, gap: 10 },
  emptyTitle: { color: TXT, fontSize: 18, fontWeight: '900' },
  emptyText: { color: MUTED, lineHeight: 20 },
  cta: { alignSelf: 'flex-start', backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  ctaText: { color: '#07120B', fontWeight: '900' },
  scoreGrid: { flexDirection: 'row', gap: 10 },
  scoreCard: { flex: 1, minHeight: 88, backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 12, justifyContent: 'space-between' },
  scoreValue: { color: TXT, fontSize: 26, fontWeight: '900' },
  scoreLabel: { color: MUTED, fontSize: 12, fontWeight: '700' },
  genreRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genrePill: { backgroundColor: '#102516', borderColor: '#285C38', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  genreText: { color: '#B6F7C6', fontSize: 12, fontWeight: '800' },
  storyPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 14 },
  storyIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#392C08', alignItems: 'center', justifyContent: 'center' },
  storyCopy: { flex: 1, minWidth: 0, gap: 3 },
  storyTitle: { color: TXT, fontSize: 16, fontWeight: '900' },
  storyText: { color: MUTED, lineHeight: 19 },
  storyTags: { color: GOLD, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: TXT, fontSize: 20, fontWeight: '900' },
  sectionTag: { color: MUTED, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  panel: { backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, overflow: 'hidden' },
  rankRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: '#1A2230' },
  rankBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 13, fontWeight: '900' },
  movementBadge: { minWidth: 24, height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1 },
  movementText: { fontSize: 11, fontWeight: '900' },
  cover: { width: 50, height: 50, borderRadius: 6 },
  coverFallback: { backgroundColor: '#263142' },
  rankCopy: { flex: 1, minWidth: 0 },
  rankTitle: { color: TXT, fontSize: 15, fontWeight: '900' },
  rankSubtitle: { color: MUTED, fontSize: 12, marginTop: 3 },
  meta: { color: GOLD, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  albumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  albumCard: { width: '48%', backgroundColor: PANEL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 10, gap: 8 },
  albumCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  albumArt: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  albumName: { color: TXT, fontWeight: '900', minHeight: 38 },
  albumArtist: { color: MUTED, fontSize: 12 },
  creator: { color: MUTED, textAlign: 'center', fontSize: 12, fontWeight: '800', marginTop: 4 },
  pressed: { opacity: 0.85 },
});

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useSpotifyConnect } from '../../hooks/useSpotifyConnect';
import { router } from 'expo-router';
import { getPublicProfile, syncSpotifyProfileToFirestore } from '../../services/spotifyFirestore';

const BG = '#0B0F14';
const CARD = '#111826';
const BORDER = '#1F2A3A';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';
const GREEN = '#1DB954';

export default function ProfileTab() {
  const { user } = useAuth();
  const [profile, setProfile] = React.useState(null);
  const [loadingProfile, setLoadingProfile] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [oauthBusy, setOauthBusy] = React.useState(false);

  const loadProfile = React.useCallback(async () => {
    if (!user?.uid) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      const data = await getPublicProfile(user.uid);
      setProfile(data);
    } catch (e) {
      Alert.alert('Profile', e?.message || 'Could not load profile');
    } finally {
      setLoadingProfile(false);
    }
  }, [user?.uid]);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onSpotifyDone = React.useCallback(() => {
    setOauthBusy(false);
    loadProfile();
  }, [loadProfile]);

  const onSpotifyErr = React.useCallback((err) => {
    setOauthBusy(false);
    Alert.alert('Spotify', err?.message || String(err));
  }, []);

  const { connect, ready, redirectUri } = useSpotifyConnect({
    uid: user?.uid,
    email: user?.email,
    onCompleted: onSpotifyDone,
    onError: onSpotifyErr,
  });

  async function handleConnectSpotify() {
    if (!ready) {
      Alert.alert('Spotify', 'Still preparing login… try again in a second.');
      return;
    }
    setOauthBusy(true);
    try {
      const res = await connect();
      if (res?.type !== 'success') setOauthBusy(false);
    } catch (e) {
      setOauthBusy(false);
      Alert.alert('Spotify', e?.message || String(e));
    }
  }

  async function handleRefreshFromSpotify() {
    if (!user?.uid) return;
    setRefreshing(true);
    try {
      await syncSpotifyProfileToFirestore(user.uid, user.email);
      await loadProfile();
    } catch (e) {
      Alert.alert('Refresh', e?.message || String(e));
    } finally {
      setRefreshing(false);
    }
  }

  async function doLogout() {
    await signOut(auth);
    router.replace('/(auth)/login');
  }

  const spotify = profile?.spotify;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Your profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Account</Text>
        <Text style={styles.value}>{user?.email || '—'}</Text>
      </View>

      <View style={styles.row}>
        <Pressable
          onPress={handleConnectSpotify}
          disabled={oauthBusy || !ready}
          style={({ pressed }) => [styles.primary, (oauthBusy || !ready) && styles.disabled, pressed && styles.pressed]}>
          {oauthBusy ? (
            <ActivityIndicator color="#06110A" />
          ) : (
            <Text style={styles.primaryText}>Connect Spotify</Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleRefreshFromSpotify}
          disabled={refreshing}
          style={({ pressed }) => [styles.secondary, refreshing && styles.disabled, pressed && styles.pressed]}>
          {refreshing ? (
            <ActivityIndicator color={TXT} />
          ) : (
            <Text style={styles.secondaryText}>Refresh from Spotify</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Add this exact Redirect URI in Spotify Dashboard → Settings:{' '}
        <Text selectable style={styles.mono}>
          {redirectUri || '…'}
        </Text>
      </Text>

      {loadingProfile ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 16 }} />
      ) : spotify ? (
        <>
          <View style={styles.hero}>
            {spotify.imageUrl ? (
              <Image source={{ uri: spotify.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.displayName}>{spotify.displayName}</Text>
              <Text style={styles.muted}>Spotify ID · {spotify.id}</Text>
            </View>
          </View>

          {!!spotify.genres?.length && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Genres</Text>
              <Text style={styles.body}>{spotify.genres.join(' · ')}</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Top artists</Text>
            {(spotify.topArtists || []).map((a) => (
              <View key={a.id} style={styles.listRow}>
                {a.imageUrl ? (
                  <Image source={{ uri: a.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                <Text style={styles.rowTitle}>{a.name}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Top tracks</Text>
            {(spotify.topTracks || []).map((t) => (
              <View key={t.id} style={styles.listRow}>
                {t.imageUrl ? (
                  <Image source={{ uri: t.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{t.name}</Text>
                  <Text style={styles.mutedSmall}>{(t.artists || []).map((x) => x.name).join(', ')}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recently played</Text>
            {(spotify.recentlyPlayed || []).map((item, idx) => (
              <View key={`${item.track?.id}-${idx}`} style={styles.listRow}>
                {item.track?.imageUrl ? (
                  <Image source={{ uri: item.track.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.track?.name}</Text>
                  <Text style={styles.mutedSmall}>{(item.track?.artists || []).map((x) => x.name).join(', ')}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.muted}>Connect Spotify to pull your listening identity into Music Shelf.</Text>
        </View>
      )}

      <Pressable onPress={() => router.push(`/profile/${user?.uid || 'demo'}`)} style={({ pressed }) => [styles.outline, pressed && styles.pressed]}>
        <Text style={styles.outlineText}>Preview public profile URL</Text>
      </Pressable>

      <Pressable onPress={doLogout} style={({ pressed }) => [styles.danger, pressed && styles.pressed]}>
        <Text style={styles.dangerText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  h1: { color: TXT, fontSize: 22, fontWeight: '800' },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
  },
  label: { color: MUTED, fontSize: 12 },
  value: { color: TXT, fontSize: 16, fontWeight: '700' },
  row: { gap: 10 },
  primary: {
    backgroundColor: GREEN,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryText: { color: '#06110A', fontWeight: '800' },
  secondary: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryText: { color: TXT, fontWeight: '700' },
  outline: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  outlineText: { color: TXT, fontWeight: '700' },
  hint: { color: MUTED, fontSize: 11, lineHeight: 16 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { backgroundColor: '#243246' },
  displayName: { color: TXT, fontSize: 20, fontWeight: '800' },
  muted: { color: MUTED },
  mutedSmall: { color: MUTED, fontSize: 12 },
  sectionTitle: { color: TXT, fontWeight: '800', marginBottom: 6 },
  body: { color: TXT },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  thumb: { width: 44, height: 44, borderRadius: 6 },
  thumbPlaceholder: { backgroundColor: '#243246' },
  rowTitle: { color: TXT, fontWeight: '600', flex: 1 },
  danger: {
    backgroundColor: '#2A0F14',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5B1A24',
  },
  dangerText: { color: '#FF6B6B', fontWeight: '800' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
});

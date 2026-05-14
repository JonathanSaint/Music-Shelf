import { Image } from 'expo-image';
import { router } from 'expo-router';
import { deleteUser, signOut } from 'firebase/auth';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useBumpSpotifySync, useSpotifySyncTick } from '../../hooks/SpotifySyncContext';
import { useAuth } from '../../hooks/useAuth';
import { useSpotifyConnect } from '../../hooks/useSpotifyConnect';
import { auth } from '../../lib/firebase';
import { generateMusicInsight } from '../../services/musicInsight';
import { deleteFirebaseUserDoc, deleteSpotifyUserData, disconnectSpotify, getPublicProfile, saveMusicInsight, syncSpotifyProfileToFirestore } from '../../services/spotifyFirestore';

const BG = '#0B0F14';
const CARD = '#111826';
const BORDER = '#1F2A3A';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';
const GREEN = '#1DB954';

const SPOTIFY_MARK =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/96px-Spotify_icon.svg.png';

export default function ProfileTab() {
  const { user } = useAuth();
  const syncTick = useSpotifySyncTick();
  const bumpSync = useBumpSpotifySync();
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
  }, [loadProfile, syncTick]);

  const onSpotifyDone = React.useCallback(() => {
    setOauthBusy(false);
    bumpSync();
    loadProfile();
  }, [loadProfile, bumpSync]);

  const onSpotifyErr = React.useCallback((err) => {
    setOauthBusy(false);
    Alert.alert('Spotify', err?.message || String(err));
  }, []);

  const { connect, ready, hasClientId, loadingRequest } = useSpotifyConnect({
    uid: user?.uid,
    email: user?.email,
    onCompleted: onSpotifyDone,
    onError: onSpotifyErr,
  });

  async function handleConnectSpotify() {
    if (!hasClientId) {
      Alert.alert('Spotify', 'Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID to .env, then restart Expo with npx expo start -c.');
      return;
    }
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
      const freshProfile = await getPublicProfile(user.uid);
      try {
        const insight = await generateMusicInsight(freshProfile?.spotify);
        await saveMusicInsight(user.uid, insight);
      } catch (aiError) {
        console.warn('AI insight skipped:', aiError?.message || aiError);
      }
      await loadProfile();
      bumpSync();
    } catch (e) {
      Alert.alert('Refresh', e?.message || String(e));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDisconnectSpotify() {
    if (!user?.uid) return;
    Alert.alert('Disconnect Spotify', 'Remove Spotify from Music Shelf? You can connect again anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            setProfile((p) => (p ? { ...p, spotify: null } : p));
            await disconnectSpotify(user.uid);
            bumpSync();
            await loadProfile();
          } catch (e) {
            Alert.alert('Spotify', e?.message || String(e));
          }
        },
      },
    ]);
  }

  async function doLogout() {
    await signOut(auth);
    router.replace('/(auth)/login');
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all saved data from Music Shelf. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) {
              Alert.alert('Delete Account', 'You are not signed in.');
              return;
            }

            try {
              await deleteSpotifyUserData(currentUser.uid);
              await deleteFirebaseUserDoc(currentUser.uid);
              await deleteUser(currentUser);
              await signOut(auth);
              router.replace('/(auth)/login');
            } catch (e) {
              const msg = e?.message || String(e);

              if (/requires-recent-login/i.test(msg) || /recent login/i.test(msg)) {
                Alert.alert('Delete Account', 'For security, please sign in again and try deletion once more.');
                router.replace('/(auth)/login');
                return;
              }

              Alert.alert('Delete Account', msg);
            }
          },
        },
      ]
    );
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
          disabled={oauthBusy || loadingRequest}
          style={({ pressed }) => [
            styles.primary,
            !!spotify && styles.primaryConnected,
            (oauthBusy || loadingRequest || !hasClientId) && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <View style={styles.spotifyBgMarks} pointerEvents="none">
            <Image source={{ uri: SPOTIFY_MARK }} style={[styles.bgMark, styles.bgMark1]} />
            <Image source={{ uri: SPOTIFY_MARK }} style={[styles.bgMark, styles.bgMark2]} />
            <Image source={{ uri: SPOTIFY_MARK }} style={[styles.bgMark, styles.bgMark3]} />
          </View>

          {oauthBusy ? (
            <ActivityIndicator color="#06110A" style={{ zIndex: 1 }} />
          ) : (
            <View style={styles.spotifyBtnInner}>
              <Text style={styles.primaryText}>
                {!hasClientId ? 'Add Spotify Client ID' : spotify ? 'Authorize with Spotify' : 'Connect Spotify'}
              </Text>
              {!!spotify && (
                <Text style={styles.primarySub}>
                  Signed in as {spotify.displayName} · opens Spotify to allow access
                </Text>
              )}
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={handleRefreshFromSpotify}
          disabled={refreshing || !spotify}
          style={({ pressed }) => [styles.secondary, (refreshing || !spotify) && styles.disabled, pressed && styles.pressed]}>
          {refreshing ? <ActivityIndicator color={TXT} /> : <Text style={styles.secondaryText}>Refresh from Spotify</Text>}
        </Pressable>

        {!!spotify && (
          <Pressable onPress={handleDisconnectSpotify} style={({ pressed }) => [styles.disconnect, pressed && styles.pressed]}>
            <Text style={styles.disconnectText}>Disconnect Spotify</Text>
          </Pressable>
        )}
      </View>

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
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{a.name}</Text>
                  {!!a.playCount && <Text style={styles.mutedSmall}>{a.playCount} plays (last 30 days)</Text>}
                </View>
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
                  <Text style={styles.mutedSmall}>
                    {(t.artists || []).map((x) => x.name).join(', ')}
                    {t.playCount > 0 ? ` · ${t.playCount} plays` : ''}
                  </Text>
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
                  <Text style={styles.mutedSmall}>
                    {(item.track?.artists || []).map((x) => x.name).join(', ')}
                  </Text>
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

      <Pressable onPress={handleDeleteAccount} style={({ pressed }) => [styles.deleteAccount, pressed && styles.pressed]}>
        <Text style={styles.deleteAccountText}>Delete Account</Text>
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
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: 52,
    position: 'relative',
  },
  primaryConnected: {
    backgroundColor: '#14833B',
    borderWidth: 1,
    borderColor: 'rgba(6, 17, 10, 0.35)',
  },
  spotifyBgMarks: { ...StyleSheet.absoluteFillObject },
  bgMark: { position: 'absolute', width: 88, height: 88, opacity: 0.14 },
  bgMark1: { top: -28, right: -12, transform: [{ rotate: '14deg' }] },
  bgMark2: { bottom: -36, left: 28, transform: [{ rotate: '-22deg' }] },
  bgMark3: { top: 8, left: -24, transform: [{ rotate: '38deg' }] },
  spotifyBtnInner: { alignItems: 'center', gap: 2, zIndex: 1 },
  primaryText: { color: '#06110A', fontWeight: '800' },
  primarySub: { color: 'rgba(6, 17, 10, 0.75)', fontSize: 12, fontWeight: '700' },
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
  disconnect: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5B1A24',
    backgroundColor: '#2A0F14',
  },
  disconnectText: { color: '#FF9B9B', fontWeight: '800' },
  deleteAccount: {
    backgroundColor: '#2A0F14',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5B1A24',
    marginTop: 2,
  },
  deleteAccountText: { color: '#FF6B6B', fontWeight: '800' },
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
});

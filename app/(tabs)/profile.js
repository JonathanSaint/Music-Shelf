import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { deleteUser, signOut } from 'firebase/auth';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ConfirmModal from '../../components/ConfirmModal';
import FeedbackModal from '../../components/FeedbackModal';
import SpotifyProgressBar from '../../components/SpotifyProgressBar';
import { mapSpotifyOAuthError } from '../../services/spotifyOAuthComplete';
import { clearPendingOAuthSession } from '../../services/spotifyOAuthSession';
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
  const [connectionProgress, setConnectionProgress] = React.useState(0);
  const [connectionStatus, setConnectionStatus] = React.useState('Connecting...');
  const [showProgress, setShowProgress] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [statusMessage, setStatusMessage] = React.useState('');
  const connectTimeoutRef = React.useRef(null);

  const resetConnectUi = React.useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    setOauthBusy(false);
    setShowProgress(false);
    setConnectionProgress(0);
    setConnectionStatus('Connecting...');
  }, []);

  React.useEffect(() => {
    resetConnectUi();
    clearPendingOAuthSession();
  }, [user?.uid, resetConnectUi]);

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
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    setConnectionProgress(1);
    setConnectionStatus('Connected successfully!');
    setTimeout(() => {
      resetConnectUi();
      setStatusMessage('Spotify connected successfully.');
      bumpSync();
      loadProfile();
    }, 1000);
  }, [loadProfile, bumpSync, resetConnectUi]);

  const onSpotifyErr = React.useCallback(
    (err) => {
      resetConnectUi();
      setStatusMessage(mapSpotifyOAuthError(err?.message || String(err)));
    },
    [resetConnectUi]
  );

  const { connect, ready, hasClientId, loadingRequest, redirectUri } = useSpotifyConnect({
    uid: user?.uid,
    email: user?.email,
    onCompleted: onSpotifyDone,
    onError: onSpotifyErr,
  });

  const handleConnectSpotify = React.useCallback(async () => {
    if (!hasClientId) {
      setStatusMessage('Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID to .env, then restart the app.');
      return;
    }
    if (!ready) {
      setStatusMessage('Still preparing Spotify login — wait a second and try again.');
      return;
    }
    if (!user?.uid) {
      setStatusMessage('Sign in before connecting Spotify.');
      return;
    }

    setStatusMessage('');
    await clearPendingOAuthSession();
    setOauthBusy(true);
    setShowProgress(true);
    setConnectionProgress(0);
    setConnectionStatus('Opening Spotify...');

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 0.1;
      if (currentProgress >= 0.7) {
        clearInterval(progressInterval);
        setConnectionProgress(0.7);
        return;
      }
      setConnectionProgress(currentProgress);
    }, 300);

    connectTimeoutRef.current = setTimeout(() => {
      resetConnectUi();
      setStatusMessage('Spotify login timed out. Close any Spotify popup, then try again.');
    }, 120000);

    try {
      const res = await connect();
      clearInterval(progressInterval);

      // Full-page redirect on web: this tab navigates away; callback page finishes OAuth.
      if (Platform.OS === 'web' && res?.type === 'success') {
        setConnectionStatus('Completing connection…');
        return;
      }

      if (res?.type !== 'success') {
        resetConnectUi();
        if (res?.type === 'dismiss' || res?.type === 'cancel') {
          setStatusMessage('Spotify login was cancelled.');
        }
      }
    } catch (e) {
      clearInterval(progressInterval);
      resetConnectUi();
      setStatusMessage(mapSpotifyOAuthError(e?.message || String(e)));
    }
  }, [hasClientId, ready, user?.uid, connect, resetConnectUi]);

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

  async function runDisconnectSpotify() {
    if (!user?.uid) return;
    try {
      setOauthBusy(true);
      await disconnectSpotify(user.uid);
      await clearPendingOAuthSession();
      bumpSync();
      await loadProfile();
      setStatusMessage('Spotify disconnected. You can reconnect anytime.');
    } catch (e) {
      setStatusMessage('Failed to disconnect: ' + (e?.message || String(e)));
      await loadProfile();
    } finally {
      setOauthBusy(false);
      setConfirmAction(null);
    }
  }

  async function runDeleteAccount() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setStatusMessage('You are not signed in.');
      setConfirmAction(null);
      return;
    }

    try {
      setOauthBusy(true);
      await deleteSpotifyUserData(currentUser.uid);
      await clearPendingOAuthSession();
      await deleteFirebaseUserDoc(currentUser.uid);
      await deleteUser(currentUser);
      await signOut(auth);
      setConfirmAction(null);
      router.replace('/(auth)/login');
    } catch (e) {
      const msg = e?.message || String(e);
      if (/requires-recent-login/i.test(msg) || /recent login/i.test(msg)) {
        setStatusMessage('For security, sign in again, then delete your account immediately.');
        await signOut(auth);
        router.replace('/(auth)/login');
        return;
      }
      setStatusMessage('Failed to delete account: ' + msg);
    } finally {
      setOauthBusy(false);
      setConfirmAction(null);
    }
  }

  async function doLogout() {
    await clearPendingOAuthSession();
    resetConnectUi();
    await signOut(auth);
    router.replace('/(auth)/login');
  }

  const spotify = profile?.spotify;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Spotify Connection Progress Bar */}
      <SpotifyProgressBar
        isVisible={showProgress}
        progress={connectionProgress}
        status={connectionStatus}
      />
      <FeedbackModal visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ConfirmModal
        visible={confirmAction === 'disconnect'}
        title="Disconnect Spotify?"
        message="Your Spotify data will be removed from Music Shelf. You can reconnect anytime. This does not delete your Spotify account."
        confirmLabel="Disconnect"
        destructive
        busy={oauthBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runDisconnectSpotify}
      />
      <ConfirmModal
        visible={confirmAction === 'delete'}
        title="Delete account forever?"
        message="This cannot be undone. All Music Shelf data, Spotify connection, and listening history for this account will be permanently removed."
        confirmLabel="Delete forever"
        destructive
        busy={oauthBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runDeleteAccount}
      />

      <Text style={styles.h1}>Your profile</Text>

      {!!statusMessage && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{statusMessage}</Text>
          <Pressable onPress={() => setStatusMessage('')} hitSlop={8}>
            <Ionicons name="close" size={18} color={MUTED} />
          </Pressable>
        </View>
      )}

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
                {!hasClientId ? 'Add Spotify Client ID' : spotify ? 'Reconnect Spotify' : 'Connect Spotify'}
              </Text>
              {!!spotify && (
                <Text style={styles.primarySub}>
                  Signed in as {spotify.displayName}
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
          <Pressable
            onPress={() => setConfirmAction('disconnect')}
            disabled={oauthBusy}
            style={({ pressed }) => [styles.disconnect, oauthBusy && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.disconnectText}>Disconnect Spotify</Text>
          </Pressable>
        )}

        {hasClientId && !!redirectUri && (
          <View style={styles.redirectCard}>
            <Text style={styles.redirectLabel}>Spotify redirect URI (add in Developer Dashboard)</Text>
            <Text selectable style={styles.redirectValue}>{redirectUri}</Text>
            <Text style={styles.redirectHint}>
              Other Spotify accounts: in Developer Dashboard → Users and Access, add each tester’s Spotify email (Development mode). This is not about which account is signed into the dashboard.
            </Text>
          </View>
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

      {/* Feedback Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Feedback</Text>
        <Text style={styles.muted}>Have suggestions or found a bug? I would love to hear from you.</Text>
        <Pressable
          onPress={() => setFeedbackOpen(true)}
          style={({ pressed }) => [styles.feedbackBtn, pressed && styles.pressed]}>
          <Ionicons name="mail-outline" size={18} color={TXT} />
          <Text style={styles.feedbackText}>Send Feedback</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => setConfirmAction('delete')}
        disabled={oauthBusy}
        style={({ pressed }) => [styles.deleteAccount, oauthBusy && styles.disabled, pressed && styles.pressed]}>
        <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
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
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A2433',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  feedbackText: { color: TXT, fontWeight: '700', fontSize: 14 },
  redirectCard: {
    backgroundColor: '#0F1623',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  redirectLabel: { color: MUTED, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  redirectValue: { color: TXT, fontSize: 12, lineHeight: 17 },
  redirectHint: { color: MUTED, fontSize: 11, lineHeight: 16, marginTop: 4 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#1A2433',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  statusText: { color: TXT, flex: 1, fontSize: 13, lineHeight: 18 },
});
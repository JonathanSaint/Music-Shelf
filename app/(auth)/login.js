import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth } from '../../lib/firebase';

const SPOTIFY_MARK =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/96px-Spotify_icon.svg.png';

const BG = '#0B0F14';
const CARD = '#111826';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';
const GREEN = '#1DB954';
const GREEN_LIGHT = '#69E58D';
const GREEN_DARK = '#14833B';

function getAuthErrorMessage(error) {
  switch (error?.code) {
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not configured yet. In Firebase Console, open Authentication > Sign-in method and enable Email/Password for this project.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'The email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'That email already has an account. Try signing in instead.';
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    default:
      return error?.message || 'Something went wrong';
  }
}

// Animated background wave component
function WaveBackground() {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [anim1, anim2, anim3].map((anim, index) =>
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: 8000 + index * 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
    );
    animations.forEach((anim) => anim.start());
    return () => animations.forEach((anim) => anim.stop());
  }, []);

  const translateX1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0, 200] });
  const translateX2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -150] });
  const translateX3 = anim3.interpolate({ inputRange: [0, 1], outputRange: [0, 180] });

  return (
    <View style={styles.waveContainer}>
      <Animated.View style={[styles.wave, styles.wave1, { transform: [{ translateX: translateX1 }] }]} />
      <Animated.View style={[styles.wave, styles.wave2, { transform: [{ translateX: translateX2 }] }]} />
      <Animated.View style={[styles.wave, styles.wave3, { transform: [{ translateX: translateX3 }] }]} />
    </View>
  );
}

function FloatingSpotifyLogo({ delay, startX, size, duration, rotate }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(animatedValue, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateY = animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 0.12, 0.12, 0],
  });

  return (
    <Animated.View
      style={[
        styles.floatingLogo,
        { left: startX, opacity, transform: [{ translateY }, { rotate: `${rotate}deg` }] },
      ]}>
      <Image source={{ uri: SPOTIFY_MARK }} style={{ width: size, height: size }} />
    </Animated.View>
  );
}

function FloatingMusicNote({ delay, startX, icon, duration }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(animatedValue, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateY = animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0, -90] });
  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 0.25, 0.25, 0],
  });

  return (
    <Animated.View style={[styles.floatingNote, { left: startX, opacity, transform: [{ translateY }] }]}>
      <Ionicons name={icon} size={18} color={GREEN_LIGHT} />
    </Animated.View>
  );
}

// Floating particle component
function FloatingParticle({ delay, startX, size, duration }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 0.3, 0.3, 0],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: startX,
          width: size,
          height: size,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace('/(tabs)');
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Background decorations */}
        <WaveBackground />
        <FloatingSpotifyLogo delay={0} startX="8%" size={28} duration={9000} rotate={-12} />
        <FloatingSpotifyLogo delay={2200} startX="78%" size={22} duration={11000} rotate={18} />
        <FloatingSpotifyLogo delay={4500} startX="42%" size={18} duration={8500} rotate={8} />
        <FloatingMusicNote delay={800} startX="22%" icon="musical-note" duration={7000} />
        <FloatingMusicNote delay={2800} startX="68%" icon="musical-notes" duration={8000} />
        <FloatingMusicNote delay={5200} startX="52%" icon="headset" duration={7500} />
        <FloatingParticle delay={0} startX="15%" size={6} duration={6000} />
        <FloatingParticle delay={1000} startX="75%" size={4} duration={7000} />
        <FloatingParticle delay={2000} startX="45%" size={5} duration={5500} />
        <FloatingParticle delay={3000} startX="85%" size={3} duration={8000} />
        <FloatingParticle delay={1500} startX="25%" size={4} duration={6500} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}>
          {/* Logo Section */}
          <View style={styles.header}>
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  shadowColor: GREEN,
                  shadowOpacity: glowOpacity,
                  shadowRadius: 20,
                },
              ]}>
              <Ionicons name="albums" size={44} color={GREEN} />
            </Animated.View>
            <Text style={styles.title}>Music Shelf</Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Sign in to build your music identity.'
                : 'Create your music identity.'}
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={MUTED} style={styles.inputIcon} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email address"
                placeholderTextColor={MUTED}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                editable={!busy}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={MUTED} style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                placeholderTextColor={MUTED}
                secureTextEntry={!showPassword}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                editable={!busy}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                disabled={busy}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={MUTED}
                />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={16} color="#FF6B6B" style={styles.errorIcon} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={busy}
              onPress={submit}
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}>
              <Animated.View
                style={[
                  styles.primaryGlow,
                  { opacity: glowOpacity },
                ]}
              />
              <Text style={styles.primaryText}>
                {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMode((m) => (m === 'signup' ? 'login' : 'signup'));
                setError('');
              }}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
              disabled={busy}>
              <Text style={styles.linkText}>
                {mode === 'signup'
                  ? 'Already have an account? Sign in'
                  : "New here? Create an account"}
              </Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.small}>
              <Ionicons name="logo-spotify" size={14} color={GREEN} />
              {' '}Spotify login comes next.{' '}
              {Platform.OS === 'web' ? 'Web uses popup redirect.' : 'Mobile uses app/browser redirect.'}
            </Text>
          </View>

          {/* Bottom decoration */}
          <View style={styles.bottomDecoration}>
            <View style={styles.bottomDots}>
              <View style={styles.bottomDot} />
              <View style={[styles.bottomDot, styles.bottomDotActive]} />
              <View style={styles.bottomDot} />
            </View>
          </View>
        </Animated.View>

        <View style={styles.legalFooter}>
          <Pressable onPress={() => router.push('/legal/privacy')} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.legalLink}>Privacy</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => router.push('/legal/terms')} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.legalLink}>Terms</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>Created by Jonathan Arinda</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%',
  },
  waveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    overflow: 'hidden',
    opacity: 0.1,
  },
  wave: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: '50%',
    backgroundColor: GREEN,
  },
  wave1: {
    top: -200,
    left: -50,
    opacity: 0.3,
  },
  wave2: {
    top: -150,
    left: 50,
    opacity: 0.2,
  },
  wave3: {
    top: -100,
    left: 100,
    opacity: 0.15,
  },
  particle: {
    position: 'absolute',
    top: '20%',
    borderRadius: '50%',
    backgroundColor: GREEN,
  },
  floatingLogo: {
    position: 'absolute',
    top: '18%',
    pointerEvents: 'none',
  },
  floatingNote: {
    position: 'absolute',
    top: '24%',
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: CARD,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(29, 185, 84, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.2)',
  },
  title: {
    color: TXT,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: MUTED,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: '50%',
    marginTop: -10,
    zIndex: 1,
  },
  input: {
    backgroundColor: '#0F1623',
    borderColor: '#243246',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 48,
    paddingVertical: 16,
    color: TXT,
    fontSize: 16,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
    padding: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  errorIcon: {
    marginTop: 2,
  },
  error: {
    color: '#FF6B6B',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  primary: {
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  primaryGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GREEN_LIGHT,
    opacity: 0,
  },
  primaryText: {
    color: '#06110A',
    fontWeight: '800',
    fontSize: 16,
    zIndex: 1,
  },
  linkBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkText: {
    color: GREEN_LIGHT,
    fontWeight: '700',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#243246',
  },
  dividerText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  small: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  bottomDecoration: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  bottomDots: {
    flexDirection: 'row',
    gap: 8,
  },
  bottomDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#243246',
  },
  bottomDotActive: {
    backgroundColor: GREEN,
  },
  legalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  legalLink: { color: GREEN_LIGHT, fontSize: 12, fontWeight: '700' },
  legalDot: { color: MUTED, fontSize: 12 },
  footer: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
});
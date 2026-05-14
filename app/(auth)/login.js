import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth } from '../../lib/firebase';

const BG = '#0B0F14';
const CARD = '#111826';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';
const GREEN = '#1DB954';
const GREEN_LIGHT = '#69E58D';

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

// Floating music note component for background animation
function FloatingNote({ delay, duration, startX, size, icon, opacity }) {
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
  }, [delay, duration]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -200],
  });

  const translateX = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 30, 0],
  });

  const noteOpacity = animatedValue.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, opacity, opacity, 0],
  });

  return (
    <Animated.View
      style={[
        styles.floatingNote,
        {
          left: startX,
          opacity: noteOpacity,
          transform: [{ translateY }, { translateX }],
        },
      ]}>
      <Ionicons name={icon} size={size} color={GREEN} />
    </Animated.View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [mode, setMode] = React.useState('login');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
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

  return (
    <View style={styles.root}>
      {/* Floating background elements */}
      <FloatingNote delay={0} duration={6000} startX="10%" size={24} icon="musical-note" opacity={0.15} />
      <FloatingNote delay={1500} duration={7000} startX="70%" size={18} icon="disc" opacity={0.1} />
      <FloatingNote delay={3000} duration={5500} startX="40%" size={20} icon="radio" opacity={0.12} />
      <FloatingNote delay={2000} duration={6500} startX="85%" size={16} icon="musical-notes" opacity={0.08} />
      <FloatingNote delay={4000} duration={7500} startX="20%" size={22} icon="volume-high" opacity={0.1} />

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
        {/* Header with animated icon */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="albums" size={40} color={GREEN} />
          </View>
          <Text style={styles.title}>Music Shelf</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' 
              ? 'Sign in to build your music identity.' 
              : 'Create your music identity.'}
          </Text>
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={MUTED}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password"
            placeholderTextColor={MUTED}
            secureTextEntry={!showPassword}
            style={styles.passwordInput}
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

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          disabled={busy}
          onPress={submit}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}>
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

        <Text style={styles.small}>
          Spotify login comes next. {Platform.OS === 'web' ? 'Web uses popup redirect.' : 'Mobile uses app/browser redirect.'}
        </Text>

        {/* Decorative bottom line */}
        <View style={styles.bottomLine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: BG, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20,
    overflow: 'hidden',
  },
  floatingNote: {
    position: 'absolute',
    top: '100%',
  },
  card: { 
    width: '100%', 
    maxWidth: 420, 
    backgroundColor: CARD, 
    borderRadius: 20, 
    padding: 24, 
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: { alignItems: 'center', gap: 8 },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { 
    color: TXT, 
    fontSize: 32, 
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: { 
    color: MUTED, 
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#0F1623',
    borderColor: '#243246',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TXT,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    backgroundColor: '#0F1623',
    borderColor: '#243246',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 48,
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
  primary: { 
    backgroundColor: GREEN, 
    paddingVertical: 14, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginTop: 4,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryText: { 
    color: '#06110A', 
    fontWeight: '800',
    fontSize: 16,
  },
  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkText: { 
    color: GREEN_LIGHT, 
    fontWeight: '700',
    fontSize: 14,
  },
  error: { 
    color: '#FF6B6B',
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 10,
  },
  small: { 
    color: MUTED, 
    fontSize: 12, 
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  bottomLine: {
    height: 2,
    width: 60,
    backgroundColor: GREEN,
    borderRadius: 1,
    marginTop: 8,
    alignSelf: 'center',
    opacity: 0.5,
  },
});
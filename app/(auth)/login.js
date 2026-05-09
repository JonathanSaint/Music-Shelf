import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { router } from 'expo-router';

const BG = '#0B0F14';
const CARD = '#111826';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';
const GREEN = '#1DB954';

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

export default function LoginScreen() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [mode, setMode] = React.useState('login'); // login | signup
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

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
      <View style={styles.card}>
        <Text style={styles.title}>Music Shelf</Text>
        <Text style={styles.subtitle}>Sign in to build your music identity.</Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={MUTED}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={MUTED}
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable disabled={busy} onPress={submit} style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}>
          <Text style={styles.primaryText}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
        </Pressable>

        <Pressable
          onPress={() => setMode((m) => (m === 'signup' ? 'login' : 'signup'))}
          style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
          <Text style={styles.linkText}>
            {mode === 'signup' ? 'Already have an account? Sign in' : "New here? Create an account"}
          </Text>
        </Pressable>

        <Text style={styles.small}>
          Spotify login comes next. {Platform.OS === 'web' ? 'Web uses popup redirect.' : 'Mobile uses app/browser redirect.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: CARD, borderRadius: 16, padding: 18, gap: 10 },
  title: { color: TXT, fontSize: 28, fontWeight: '700' },
  subtitle: { color: MUTED, marginBottom: 6 },
  input: {
    backgroundColor: '#0F1623',
    borderColor: '#243246',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: TXT,
  },
  primary: { backgroundColor: GREEN, paddingVertical: 12, borderRadius: 999, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#06110A', fontWeight: '800' },
  linkBtn: { paddingVertical: 10, alignItems: 'center' },
  linkText: { color: TXT, fontWeight: '600' },
  error: { color: '#FF6B6B' },
  small: { color: MUTED, fontSize: 12, marginTop: 6 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});


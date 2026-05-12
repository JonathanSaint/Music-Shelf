import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '../hooks/useAuth';
import { SpotifySyncProvider } from '../hooks/SpotifySyncContext';

WebBrowser.maybeCompleteAuthSession();

function SpotifySyncGate({ children }) {
  const { user, loading } = useAuth();
  /** Keep a stable parent around Stack so expo-router does not remount navigation when auth finishes. */
  const uid = loading ? null : user?.uid ?? null;
  const email = user?.email ?? null;
  return (
    <SpotifySyncProvider uid={uid} email={email}>
      {children}
    </SpotifySyncProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SpotifySyncGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="item/[kind]" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="spotify-callback" />
      </Stack>
      </SpotifySyncGate>
      <StatusBar style="light" />
    </AuthProvider>
  );
}


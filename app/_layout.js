import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-reanimated';
import { Analytics } from '@vercel/analytics/react';

import { AuthProvider } from '../hooks/useAuth';

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile/[id]" />
        <Stack.Screen name="spotify-callback" />
      </Stack>
      <StatusBar style="light" />
      <Analytics />
    </AuthProvider>
  );
}


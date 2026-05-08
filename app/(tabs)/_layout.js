import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function TabLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0B0F14', borderTopColor: '#1F2A3A' },
        tabBarActiveTintColor: '#1DB954',
        tabBarInactiveTintColor: '#9AA4B2',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}


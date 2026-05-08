import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

export default function SearchTab() {
  const [q, setQ] = React.useState('');

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Search</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search users (MVP placeholder)"
        placeholderTextColor="#9AA4B2"
        style={styles.input}
      />
      <View style={styles.card}>
        <Text style={styles.muted}>Results will show here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0F14', padding: 16, gap: 12 },
  h1: { color: '#E6EDF3', fontSize: 22, fontWeight: '800' },
  input: {
    backgroundColor: '#0F1623',
    borderColor: '#243246',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#E6EDF3',
  },
  card: { backgroundColor: '#111826', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1F2A3A' },
  muted: { color: '#9AA4B2' },
});


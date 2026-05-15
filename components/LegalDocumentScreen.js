import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { APP_NAME, CONTACT_EMAIL, LAST_UPDATED } from '../constants/legal';

const BG = '#0B0F14';
const CARD = '#111826';
const BORDER = '#1F2A3A';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';
const GREEN = '#1DB954';

export default function LegalDocumentScreen({ title, sections }) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={TXT} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{APP_NAME}</Text>
          <Text style={styles.h1}>{title}</Text>
          <Text style={styles.updated}>Last updated {LAST_UPDATED}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {sections.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.body}>{CONTACT_EMAIL}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 48,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { color: GREEN, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  h1: { color: TXT, fontSize: 24, fontWeight: '900' },
  updated: { color: MUTED, fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
  },
  sectionTitle: { color: TXT, fontSize: 16, fontWeight: '800' },
  body: { color: MUTED, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.85 },
});

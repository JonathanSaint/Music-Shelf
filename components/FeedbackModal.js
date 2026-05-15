import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const BG = '#111826';
const BORDER = '#1F2A3A';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';
const GREEN = '#1DB954';

const FEEDBACK_EMAIL = 'jarinda086@gmail.com';

export default function FeedbackModal({ visible, onClose }) {
  const [subject, setSubject] = React.useState('Music Shelf Feedback');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setSubject('Music Shelf Feedback');
      setMessage('');
    }
  }, [visible]);

  function sendFeedback() {
    const qs = new URLSearchParams({
      subject: subject.trim() || 'Music Shelf Feedback',
      body: message.trim() || 'Hi,\n\n',
    });
    Linking.openURL(`mailto:${FEEDBACK_EMAIL}?${qs.toString()}`);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Send feedback</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={MUTED} />
            </Pressable>
          </View>
          <Text style={styles.hint}>Share ideas, bugs, or feature requests. Opens your mail app with a draft.</Text>

          <Text style={styles.label}>Subject</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            placeholderTextColor={MUTED}
            style={styles.input}
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what's on your mind…"
            placeholderTextColor={MUTED}
            style={[styles.input, styles.textarea]}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Pressable onPress={sendFeedback} style={({ pressed }) => [styles.sendBtn, pressed && styles.pressed]}>
            <Ionicons name="mail-outline" size={18} color="#06110A" />
            <Text style={styles.sendText}>Open mail app</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 20 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: BG,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
    zIndex: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: TXT, fontSize: 18, fontWeight: '800' },
  hint: { color: MUTED, fontSize: 13, lineHeight: 18 },
  label: { color: MUTED, fontSize: 12, fontWeight: '700', marginTop: 4 },
  input: {
    backgroundColor: '#0F1623',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TXT,
    fontSize: 15,
  },
  textarea: { minHeight: 110 },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 6,
  },
  sendText: { color: '#06110A', fontWeight: '800' },
  pressed: { opacity: 0.85 },
});

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const BG = '#111826';
const BORDER = '#1F2A3A';
const TXT = '#E6EDF3';
const MUTED = '#9AA4B2';

/**
 * Cross-platform confirm dialog (Alert.alert is unreliable on web).
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={busy ? undefined : onCancel} />
        <View style={styles.sheet}>
          <View style={styles.iconRow}>
            <Ionicons
              name={destructive ? 'warning-outline' : 'help-circle-outline'}
              size={28}
              color={destructive ? '#FF6B6B' : '#69E58D'}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed, busy && styles.disabled]}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                destructive && styles.confirmDestructive,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}>
              <Text style={[styles.confirmText, destructive && styles.confirmTextDestructive]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: BG,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
    zIndex: 1,
  },
  iconRow: { alignItems: 'center', marginBottom: 4 },
  title: { color: TXT, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  message: { color: MUTED, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  cancelText: { color: TXT, fontWeight: '700' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1DB954',
    alignItems: 'center',
  },
  confirmDestructive: { backgroundColor: '#2A0F14', borderWidth: 1, borderColor: '#5B1A24' },
  confirmText: { color: '#06110A', fontWeight: '800' },
  confirmTextDestructive: { color: '#FF6B6B' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
});

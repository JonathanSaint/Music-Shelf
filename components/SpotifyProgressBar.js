import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

export default function SpotifyProgressBar({ isVisible, progress = 0, status = 'Connecting...' }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
        },
      ]}>
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}>
        <View style={styles.iconContainer}>
          <Ionicons name="logo-spotify" size={32} color="#1DB954" />
        </View>
        
        <Text style={styles.status}>{status}</Text>
        
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        
        <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
        
        <View style={styles.steps}>
          <View style={[styles.step, progress >= 0.25 && styles.stepActive]}>
            <Ionicons name="checkmark" size={12} color={progress >= 0.25 ? '#1DB954' : '#3A4555'} />
          </View>
          <View style={[styles.stepLine, progress >= 0.5 && styles.stepLineActive]} />
          <View style={[styles.step, progress >= 0.5 && styles.stepActive]}>
            <Ionicons name="checkmark" size={12} color={progress >= 0.5 ? '#1DB954' : '#3A4555'} />
          </View>
          <View style={[styles.stepLine, progress >= 0.75 && styles.stepLineActive]} />
          <View style={[styles.step, progress >= 0.75 && styles.stepActive]}>
            <Ionicons name="checkmark" size={12} color={progress >= 0.75 ? '#1DB954' : '#3A4555'} />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 15, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#111826',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    minWidth: 280,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    color: '#E6EDF3',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#1F2A3A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 3,
  },
  progressText: {
    color: '#9AA4B2',
    fontSize: 12,
    fontWeight: '700',
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginTop: 4,
  },
  step: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1F2A3A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3A4555',
  },
  stepActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    borderColor: '#1DB954',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#1F2A3A',
    width: 30,
  },
  stepLineActive: {
    backgroundColor: '#1DB954',
  },
});
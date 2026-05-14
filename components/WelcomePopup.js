import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Confetti particle component
function ConfettiPiece({ delay, startX, color, rotation }) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => {
      clearTimeout(timer);
      animatedValue.stopAnimation();
    };
  }, [delay]);

  if (!visible) return null;

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 300],
  });

  const translateX = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, (startX - SCREEN_WIDTH / 2) * 0.5, (startX - SCREEN_WIDTH / 2) * 0.3],
  });

  const rotate = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [`${rotation}deg`, `${rotation + 720}deg`],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          left: startX,
          backgroundColor: color,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

export default function WelcomePopup({ userName, isVisible, onHide }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Generate greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', icon: 'sunny' };
    if (hour < 17) return { text: 'Good afternoon', icon: 'partly-sunny' };
    if (hour < 21) return { text: 'Good evening', icon: 'moon' };
    return { text: 'Good night', icon: 'moon' };
  };

  const greeting = getGreeting();
  const displayName = userName || 'Music Lover';

  // Confetti colors
  const confettiColors = ['#69E58D', '#7AA7FF', '#FF7AB6', '#FFD166', '#1DB954'];

  // Generate confetti pieces
  const confettiPieces = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    delay: i * 50 + Math.random() * 100,
    startX: Math.random() * SCREEN_WIDTH,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    rotation: Math.random() * 360,
  }));

  useEffect(() => {
    if (isVisible) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after 4 seconds
      const timer = setTimeout(() => {
        hidePopup();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const hidePopup = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
        },
      ]}>
      {/* Confetti */}
      {confettiPieces.map((piece) => (
        <ConfettiPiece key={piece.id} {...piece} />
      ))}

      <Animated.View
        style={[
          styles.popup,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim },
            ],
          },
        ]}>
        <View style={styles.iconContainer}>
          <Ionicons name={greeting.icon} size={32} color="#FFD166" />
        </View>
        
        <Text style={styles.greeting}>{greeting.text}</Text>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.message}>Welcome to your music shelf</Text>

        <Animated.View style={styles.indicator} />
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 80,
    zIndex: 1000,
    pointerEvents: 'none',
  },
  popup: {
    backgroundColor: 'rgba(17, 24, 38, 0.95)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(105, 229, 141, 0.3)',
    shadowColor: '#69E58D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    minWidth: 280,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 209, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  greeting: {
    color: '#FFD166',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: {
    color: '#F2F6FA',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: '#9AA4B2',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  indicator: {
    width: 40,
    height: 3,
    backgroundColor: 'rgba(105, 229, 141, 0.3)',
    borderRadius: 2,
    marginTop: 12,
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 2,
    top: -10,
  },
});
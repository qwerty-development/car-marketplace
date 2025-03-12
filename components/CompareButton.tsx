import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface CompareButtonProps {
  onPress: () => void;
  enabled: boolean;
  isDarkMode: boolean;
}

const CompareButton: React.FC<CompareButtonProps> = ({ onPress, enabled, isDarkMode }) => {
  // Animation for attention
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (enabled) {
      // Create pulsing animation for the button when enabled
      const pulseAnimation = Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]);

      // Start the animation and repeat it
      Animated.loop(
        pulseAnimation,
        { iterations: 3 }
      ).start();
    }
  }, [enabled, scaleAnim]);

  return (
    <Animated.View style={[
      styles.container,
      {
        transform: [{ scale: scaleAnim }],
        opacity: enabled ? 1 : 0.6
      }
    ]}>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: enabled ? '#D55004' : isDarkMode ? '#333333' : '#CCCCCC' }
        ]}
        onPress={onPress}
        disabled={!enabled}
      >
        <Ionicons name="git-compare-outline" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
        <Text style={styles.buttonText}>Compare Cars</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  }
});

export default CompareButton;
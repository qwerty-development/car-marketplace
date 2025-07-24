import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTheme } from '@/utils/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

interface ModernUpdateAlertProps {
  isVisible: boolean;
  onUpdate: () => Promise<void>;
  onClose?: () => void;
}

// Use your accent color throughout
const accentColor = '#D55004';
const accentDark = '#B8420C';
const accentRGBA = 'rgba(213,80,4,'; // append alpha

const ModernUpdateAlert: React.FC<ModernUpdateAlertProps> = ({
  isVisible,
  onUpdate,
  onClose,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { isDarkMode } = useTheme();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Entrance & confetti
  useEffect(() => {
    if (isVisible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      progressAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 90,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Show confetti
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [isVisible]);

  // Progress animation
  useEffect(() => {
    if (isUpdating) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [isUpdating]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await onUpdate();
    } catch (error) {
      console.error('Update failed:', error);
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    if (!isUpdating && onClose) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => onClose());
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View
        style={{ flex: 1, opacity: fadeAnim }}
        className="justify-center items-center px-4"
      >
        {/* Backdrop */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          className="absolute inset-0"
        >
          <LinearGradient
            colors={
              isDarkMode
                ? [`${accentRGBA}0.7)`, `${accentRGBA}0.9)`]
                : [`${accentRGBA}0.4)`, `${accentRGBA}0.6)`]
            }
            style={{ flex: 1 }}
          />
        </TouchableOpacity>

        {/* Confetti */}
        {showConfetti && (
          <ConfettiCannon
            count={150}
            origin={{ x: screenWidth / 2, y: 0 }}
            fadeOut
          />
        )}

        {/* Main Card */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            maxWidth: Math.min(screenWidth - 32, 420),
            width: '100%',
          }}
          className={`mx-4 rounded-3xl shadow-2xl overflow-hidden ${
            isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'
          }`}
        >
          {/* Header Section */}
          <View className="relative overflow-hidden">
            <LinearGradient
              colors={
                isDarkMode
                  ? [`${accentRGBA}0.1)`, 'rgba(30,30,30,0.95)']
                  : [`${accentRGBA}0.2)`, 'rgba(255,255,255,0.95)']
              }
              className="px-8 pt-12 pb-8"
            >
              <Animated.View
                style={{ transform: [{ scale: pulseAnim }] }}
                className="items-center mb-6"
              >
                <View
                  className={`w-24 h-24 rounded-3xl items-center justify-center ${
                    isDarkMode ? 'bg-[#D55004]/20' : 'bg-[#D55004]/10'
                  }`}
                  style={{
                    shadowColor: accentColor,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.4,
                    shadowRadius: 20,
                    elevation: 14,
                  }}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={40}
                    color={accentColor}
                  />
                </View>
              </Animated.View>

              <Text
                className="text-3xl font-extrabold text-center mb-2"
                style={{ color: accentColor }}
              >
                Update Complete! 🎉
              </Text>

              <Text
                className={`text-lg text-center ${
                  isDarkMode ? 'text-white/70' : 'text-gray-600'
                }`}
              >
                We've added an AI assistant to help you choose your perfect car
              </Text>
            </LinearGradient>
          </View>

          {/* Action Buttons */}
          <View className="px-8 py-6 space-y-4">
            <TouchableOpacity
              onPress={handleUpdate}
              disabled={isUpdating}
              activeOpacity={0.8}
              className={`rounded-2xl shadow-lg ${
                isUpdating ? 'opacity-80' : 'active:opacity-70'
              }`}
              style={{
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 10,
              }}
            >
              <LinearGradient
                colors={[accentColor, accentDark]}
                className="py-4 px-6 rounded-2xl"
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isUpdating ? (
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white text-base font-bold ml-3">
                      Applying Changes...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center justify-center">
                    <Ionicons
                      name="rocket-outline"
                      size={22}
                      color="white"
                    />
                    <Text className="text-white text-base font-bold ml-2">
                      Experience Now
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClose}
              disabled={isUpdating}
              className="py-3"
            >
              <Text
                className={`text-center text-sm ${
                  isDarkMode ? 'text-white/60' : 'text-gray-500'
                }`}
              >
                Maybe Later
              </Text>
            </TouchableOpacity>
          </View>

          {/* Progress Indicator */}
          {isUpdating && (
            <View className="px-8 pb-8">
              <View className="h-2 rounded-full overflow-hidden mb-4 bg-gray-200">
                <Animated.View
                  style={{
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  }}
                  className="h-full rounded-full"
                >
                  <LinearGradient
                    colors={[accentColor, accentDark]}
                    className="h-full rounded-full"
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                </Animated.View>
              </View>
              <Text
                className={`text-center text-xs ${
                  isDarkMode ? 'text-white/40' : 'text-gray-500'
                }`}
              >
                Hang tight, your new AI helper is installing
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default ModernUpdateAlert;

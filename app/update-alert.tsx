import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ModernUpdateAlertProps {
  isVisible: boolean;
  onUpdate: () => Promise<void>;
  onClose?: () => void;
}

const ModernUpdateAlert: React.FC<ModernUpdateAlertProps> = ({ 
  isVisible, 
  onUpdate, 
  onClose 
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { isDarkMode } = useTheme();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize animations when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      progressAnim.setValue(0);
      
      // Entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Start pulse animation for icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isVisible]);

  // Progress animation when updating
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
      ]).start(() => {
        onClose();
      });
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <Animated.View 
        style={{ 
          flex: 1,
          opacity: fadeAnim,
        }}
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
                ? ['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']
                : ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)']
            }
            style={{ flex: 1 }}
          />
        </TouchableOpacity>
        
        {/* Main Card */}
        <Animated.View 
          style={{
            transform: [{ scale: scaleAnim }],
            maxWidth: Math.min(screenWidth - 32, 400),
            width: '100%',
          }}
          className={`mx-4 rounded-3xl shadow-2xl overflow-hidden ${
            isDarkMode ? 'bg-[#242424]' : 'bg-white'
          }`}
        >
          {/* Header Section with Gradient */}
          <View className="relative overflow-hidden">
            <LinearGradient
              colors={
                isDarkMode 
                  ? ['rgba(213, 80, 4, 0.1)', 'rgba(36, 36, 36, 0.95)']
                  : ['rgba(213, 80, 4, 0.05)', 'rgba(255, 255, 255, 0.95)']
              }
              className="px-8 pt-10 pb-6"
            >
              {/* Floating Icon with Animation */}
              <Animated.View 
                style={{
                  transform: [{ scale: pulseAnim }],
                }}
                className="items-center mb-6"
              >
                <View 
                  className={`w-20 h-20 rounded-3xl items-center justify-center ${
                    isDarkMode ? 'bg-[#D55004]/20' : 'bg-[#D55004]/10'
                  }`}
                  style={{
                    shadowColor: '#D55004',
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    shadowOpacity: 0.3,
                    shadowRadius: 16,
                    elevation: 12,
                  }}
                >
                  <Ionicons 
                    name="download-outline" 
                    size={36} 
                    color="#D55004" 
                  />
                </View>
              </Animated.View>
              
              {/* Title */}
              <Text 
                className={`text-2xl font-bold text-center mb-2 ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}
              >
                Fleet Update Ready
              </Text>
              
              {/* Subtitle */}
              <Text 
                className={`text-base text-center ${
                  isDarkMode ? 'text-white/70' : 'text-gray-600'
                }`}
              >
                Enhanced features await
              </Text>
            </LinearGradient>
          </View>

          {/* Content Section */}
          <View className="px-8 py-6">
            {/* Feature Highlights */}
            <View className="mb-8">
              <View className="flex-row items-center mb-3">
                <View 
                  className={`w-2 h-2 rounded-full mr-3 ${
                    isDarkMode ? 'bg-[#D55004]' : 'bg-[#D55004]'
                  }`} 
                />
                <Text 
                  className={`text-sm ${
                    isDarkMode ? 'text-white/80' : 'text-gray-700'
                  }`}
                >
                 Dealerships can now add and view trims 
                </Text>
              </View>
              
            
            </View>

            {/* Action Buttons */}
            <View className="space-y-3">
              {/* Primary Update Button */}
              <TouchableOpacity
                className={`relative overflow-hidden rounded-2xl shadow-lg ${
                  isUpdating ? 'opacity-80' : 'active:opacity-70'
                }`}
                onPress={handleUpdate}
                disabled={isUpdating}
                activeOpacity={0.7}
                style={{
                  shadowColor: '#D55004',
                  shadowOffset: {
                    width: 0,
                    height: 4,
                  },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <LinearGradient
                  colors={['#D55004', '#B8420C']}
                  className="py-4 px-6"
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isUpdating ? (
                    <View className="flex-row items-center justify-center">
                      <ActivityIndicator size="small" color="white" />
                      <Text className="text-white text-base font-bold ml-3">
                        Installing Update...
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center justify-center">
                      <Ionicons name="rocket-outline" size={20} color="white" />
                      <Text className="text-white text-base font-bold ml-2">
                        Install Now
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

             
            </View>
          </View>

          {/* Progress Indicator */}
          {isUpdating && (
            <View className="px-8 pb-8">
              {/* Progress Bar */}
              <View 
                className={`h-2 rounded-full overflow-hidden mb-4 ${
                  isDarkMode ? 'bg-[#2b2b2b]' : 'bg-gray-200'
                }`}
              >
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
                    colors={['#D55004', '#B8420C']}
                    className="h-full rounded-full"
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                </Animated.View>
              </View>
              
              {/* Progress Text */}
              <Text 
                className={`text-sm text-center ${
                  isDarkMode ? 'text-white/60' : 'text-gray-500'
                }`}
              >
                Please keep the app open during installation
              </Text>
              
              {/* Warning */}
              <View className="flex-row items-center justify-center mt-3">
                <Ionicons 
                  name="information-circle-outline" 
                  size={16} 
                  color={isDarkMode ? '#FFFFFF60' : '#6B7280'} 
                />
                <Text 
                  className={`text-xs ml-2 ${
                    isDarkMode ? 'text-white/40' : 'text-gray-400'
                  }`}
                >
                  App will restart automatically
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default ModernUpdateAlert;
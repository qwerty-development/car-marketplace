import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';

const ElegantUpdateAlert = ({ isVisible, onUpdate, onClose }: any) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { isDarkMode } = useTheme();

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await onUpdate();
    } catch (error) {
      console.error('Update failed:', error);
      setIsUpdating(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View className="flex-1 justify-center items-center px-4">
        {/* Backdrop with subtle blur effect */}
        <View className="absolute inset-0 bg-black/60" />
        
        {/* Main Card */}
        <View 
          className={`max-w-sm w-full mx-4 rounded-3xl shadow-2xl overflow-hidden ${
            isDarkMode ? 'bg-[#242424]' : 'bg-white'
          }`}
        >
          {/* Header Section */}
          <View className="relative overflow-hidden">
            <LinearGradient
              colors={
                isDarkMode 
                  ? ['rgba(36, 36, 36, 0.95)', 'rgba(43, 43, 43, 0.95)']
                  : ['rgba(255, 255, 255, 0.95)', 'rgba(225, 225, 225, 0.95)']
              }
              className="px-8 py-8"
            >
              {/* Icon Container */}
              <View 
                className={`w-16 h-16 rounded-2xl items-center justify-center mx-auto mb-4`}
              >
                <Ionicons 
                  name="arrow-down-circle" 
                  size={32} 
                  color={isDarkMode ? "#FFFFFF" : "#000000"} 
                />
              </View>
              
              <Text 
                className={`text-xl font-bold text-center ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}
              >
                Update Available
              </Text>
            </LinearGradient>
          </View>

          {/* Content Section */}
          <View className="px-8 py-6">
            <Text 
              className={`text-base text-center leading-6 mb-8 ${
                isDarkMode ? 'text-white/80' : 'text-gray-600'
              }`}
            >
              A new version has been downloaded and is ready to install. The app will restart to complete the update.
            </Text>

            {/* Action Buttons */}
            <View className="space-y-3">
              {/* Primary Update Button */}
              <TouchableOpacity
                className={`relative overflow-hidden rounded-2xl shadow-lg ${
                  isUpdating ? 'opacity-80' : 'active:opacity-90'
                }`}
                onPress={handleUpdate}
                disabled={isUpdating}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#D55004', '#D55004']}
                  className="py-4 px-6"
                >
                  {isUpdating ? (
                    <View className="flex-row items-center justify-center">
                      <ActivityIndicator size="small" color="white" className="mr-3" />
                      <Text className="text-white text-base font-semibold">
                        Installing Update...
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center justify-center">
                      <Ionicons name="download-outline" size={20} color="white" className="mr-2" />
                      <Text className="text-white text-base font-semibold ml-2">
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
            <View className="px-8 pb-6">
              <View 
                className={`h-1 rounded-full overflow-hidden ${
                  isDarkMode ? 'bg-[#2b2b2b]' : 'bg-gray-200'
                }`}
              >
                <LinearGradient
                  colors={['#DC2626', '#B91C1C']}
                  className="h-full w-3/4 rounded-full"
                />
              </View>
              <Text 
                className={`text-sm text-center mt-3 ${
                  isDarkMode ? 'text-white/60' : 'text-gray-500'
                }`}
              >
                Please don't close the app during installation
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ElegantUpdateAlert
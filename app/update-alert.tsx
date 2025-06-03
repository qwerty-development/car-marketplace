import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';

const ModernUpdateAlert = ({ isVisible, onUpdate, onClose }: any) => {
  const [isUpdating, setIsUpdating] = useState(false);

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
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-2xl max-w-sm w-full mx-4 overflow-hidden shadow-2xl">
          {/* Header with gradient effect */}
          <View className="bg-red-500 py-6 px-6 items-center">
            <Text className="text-xl font-bold text-black text-center">
              Update Available
            </Text>
          </View>

          {/* Content */}
          <View className="p-6">
            <View className="items-center mb-6">
              <Text className="text-5xl mb-3">📱</Text>
              <Text className="text-base text-red text-center leading-6">
                A new version has been downloaded and is ready to install.{'\n'}
                The app will restart to apply the update.
              </Text>
            </View>

            {/* Action buttons */}
            <View className="space-y-3">
              <TouchableOpacity
                className={`py-3 px-4 rounded-xl shadow-lg ${
                  isUpdating 
                    ? 'bg-red' 
                    : 'bg-red active:bg-red-600'
                }`}
                onPress={handleUpdate}
                disabled={isUpdating}
                activeOpacity={0.8}
              >
                {isUpdating ? (
                  <View className="flex-row items-center justify-center space-x-2">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white text-base font-semibold">
                      Updating...
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center justify-center space-x-2">
                    <Text className="text-base text-white">⬇️</Text>
                    <Text className="text-white text-base font-semibold">
                      Update Now
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {!isUpdating && (
                <TouchableOpacity
                  className="bg-gray-100 active:bg-gray-200 py-3 px-4 rounded-xl"
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Progress indicator when updating */}
        </View>
      </View>
    </Modal>
  );
};

export default ModernUpdateAlert;
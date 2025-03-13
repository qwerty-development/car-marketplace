import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  Alert,
  Share,
  Animated as RNAnimated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Car } from '@/components/comparison/types';
import styles from '@/components/comparison/styles';
import { Ionicons } from '@expo/vector-icons';
const { width, height } = Dimensions.get('window');

export const ShareButton = ({
  car1,
  car2,
  isDarkMode
}: {
  car1: Car | null;
  car2: Car | null;
  isDarkMode: boolean;
}) => {
  const handleShare = async () => {
    if (!car1 || !car2) return;

    try {
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Create share content
      const title = `Car Comparison: ${car1.make} ${car1.model} vs ${car2.make} ${car2.model}`;
      const message = `I'm comparing a ${car1.year} ${car1.make} ${car1.model} ($${car1.price.toLocaleString()}) with a ${car2.year} ${car2.make} ${car2.model} ($${car2.price.toLocaleString()}) using Fleet app.`;

      const url = `fleet://comparison?car1Id=${car1.id}&car2Id=${car2.id}`;

      // Show share dialog
      const result = await Share.share(
        {
          title,
          message: message + '\n\n' + url,
          url: url
        },
        {
          dialogTitle: 'Share Car Comparison',
          subject: title
        }
      );

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log(`Shared via ${result.activityType}`);
        } else {
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
      }
    } catch (error) {
      console.error('Error sharing comparison:', error);
      Alert.alert('Error', 'Unable to share this comparison');
    }
  };

  return (
    <View style={styles.shareButtonContainer}>
      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShare}
        disabled={!car1 || !car2}
      >
        <Ionicons name="share-outline" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};
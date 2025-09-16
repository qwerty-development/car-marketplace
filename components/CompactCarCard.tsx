import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = 270;
const CARD_HEIGHT = 320;

interface CompactCarCardProps {
  car: {
    id: number;
    make: string;
    model: string;
    year: number;
    price: number;
    mileage: number;
    transmission: string;
    condition: string;
    images: string[];
    dealership_name: string;
    dealership_location: string;
    dealership_phone?: string;
    views?: number;
    likes?: number;
  };
  isDarkMode: boolean;
  onPress: () => void;
}

export default function CompactCarCard({ car, isDarkMode, onPress }: CompactCarCardProps) {
  const { t } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleCall = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (car.dealership_phone) {
      Linking.openURL(`tel:${car.dealership_phone}`);
    } else {
      Alert.alert(t('common.phone_not_available'));
    }
  }, [car.dealership_phone]);

  const handleWhatsApp = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (car.dealership_phone) {
      const cleanedPhoneNumber = car.dealership_phone
        .toString()
        .replace(/\D/g, "");

      const message = `Hi! I'm interested in the ${car.year} ${car.make} ${car.model} for $${car.price.toLocaleString()}`;
      const encodedMessage = encodeURIComponent(message);
      const webURL = `https://wa.me/961${cleanedPhoneNumber}?text=${encodedMessage}`;

      Linking.openURL(webURL).catch(() => {
        Alert.alert(t('common.error'), t('common.whatsapp_open_failed'));
      });
    } else {
      Alert.alert(t('common.phone_not_available'));
    }
  }, [car]);

  const handleCardPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF',
          shadowColor: isDarkMode ? '#000' : '#000',
        }
      ]}
      onPress={handleCardPress}
      activeOpacity={0.95}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: car.images[0] || 'https://via.placeholder.com/270x160' }}
          style={[
            styles.carImage,
            { opacity: imageLoaded ? 1 : 0 }
          ]}
          onLoad={() => setImageLoaded(true)}
          resizeMode="cover"
        />
        
        {!imageLoaded && (
          <View style={[
            styles.carImage,
            styles.imagePlaceholder,
            { backgroundColor: isDarkMode ? '#404040' : '#F0F0F0' }
          ]}>
            <Ionicons 
              name="car-outline" 
              size={40} 
              color={isDarkMode ? '#666' : '#999'} 
            />
          </View>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.imageGradient}
        />

        {/* Price Badge */}
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>
            ${car.price.toLocaleString()}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="eye-outline" size={14} color="#FFFFFF" />
            <Text style={styles.statText}>{car.views || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={14} color="#FFFFFF" />
            <Text style={styles.statText}>{car.likes || 0}</Text>
          </View>
        </View>
      </View>

      {/* Content Section */}
      <View style={styles.contentContainer}>
        {/* Car Title */}
        <Text
          style={[
            styles.carTitle,
            { color: isDarkMode ? '#FFFFFF' : '#000000' }
          ]}
          numberOfLines={1}
        >
          {car.year} {car.make} {car.model}
        </Text>

        {/* Specs Row */}
        <View style={styles.specsContainer}>
          <View style={styles.specItem}>
            <MaterialCommunityIcons
              name="highway"
              size={16}
              color={isDarkMode ? '#B0B0B0' : '#666666'}
            />
            <Text style={[
              styles.specText,
              { color: isDarkMode ? '#B0B0B0' : '#666666' }
            ]}>
              {(car.mileage / 1000).toFixed(0)}k Km
            </Text>
          </View>
          
          <View style={styles.specDivider} />
          
          <View style={styles.specItem}>
            <MaterialCommunityIcons
              name="car-shift-pattern"
              size={16}
              color={isDarkMode ? '#B0B0B0' : '#666666'}
            />
            <Text style={[
              styles.specText,
              { color: isDarkMode ? '#B0B0B0' : '#666666' }
            ]}>
              {car.transmission === 'Automatic' ? 'Auto' : 'Manual'}
            </Text>
          </View>
        </View>

        {/* Dealership Info */}
        <View style={styles.dealershipContainer}>
          <View style={styles.dealershipInfo}>
            <Text
              style={[
                styles.dealershipName,
                { color: isDarkMode ? '#FFFFFF' : '#000000' }
              ]}
              numberOfLines={1}
            >
              {car.dealership_name}
            </Text>
            <Text
              style={[
                styles.dealershipLocation,
                { color: isDarkMode ? '#B0B0B0' : '#666666' }
              ]}
              numberOfLines={1}
            >
              {car.dealership_location}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isDarkMode ? '#404040' : '#F0F0F0' }
              ]}
              onPress={handleCall}
            >
              <Ionicons
                name="call-outline"
                size={16}
                color={isDarkMode ? '#FFFFFF' : '#000000'}
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: '#25D366' }
              ]}
              onPress={handleWhatsApp}
            >
              <Ionicons
                name="logo-whatsapp"
                size={16}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Condition Badge */}
        <View style={[
          styles.conditionBadge,
          {
            backgroundColor: car.condition === 'Excellent' ? '#10B981' :
                            car.condition === 'Good' ? '#F59E0B' :
                            car.condition === 'Fair' ? '#EF4444' : '#6B7280'
          }
        ]}>
          <Text style={styles.conditionText}>
            {car.condition}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    marginRight: 16,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 160,
    position: 'relative',
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  priceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#D55004',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    position: 'relative',
  },
  carTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  specsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  specText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  specDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#CCCCCC',
    marginHorizontal: 12,
  },
  dealershipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dealershipInfo: {
    flex: 1,
    marginRight: 8,
  },
  dealershipName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  dealershipLocation: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  conditionBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
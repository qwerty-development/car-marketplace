import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, I18nManager } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { formatMileage } from '@/utils/formatMileage';
import CachedImage from '@/utils/CachedImage';
import { useTranslation } from 'react-i18next';

interface ChatCarCardProps {
  car: any;
  onPress: () => void;
}

export default function ChatCarCard({ car, onPress }: ChatCarCardProps) {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;
  const isDeleted = car?.status === 'deleted';
  const styles = getStyles(isDarkMode, isRTL, isDeleted);
  
  // For deleted cars, we still allow pressing to open details but the navigation
  // will need to be handled by the parent component
  const handlePress = () => {
    if (!isDeleted) {
      onPress();
    }
  };
  
  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={isDeleted ? 1 : 0.85} 
      onPress={handlePress}
      disabled={isDeleted}
    >
      <View style={styles.imageContainer}>
        <CachedImage
          source={{ uri: car.images?.[0] || '' }}
          style={[styles.image, isDeleted && { opacity: 0.4 }]}
          contentFit="cover"
          cachePolicy="disk"
        />
        {isDeleted ? (
          <View style={styles.deletedBadge}>
            <Text style={styles.deletedText}>{t('car.deleted', 'Deleted')}</Text>
          </View>
        ) : (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>${car.price?.toLocaleString() || 'N/A'}</Text>
          </View>
        )}
        {isDeleted && (
          <View style={styles.deletedOverlay}>
            <Ionicons name="close-circle" size={40} color="rgba(255,255,255,0.8)" />
            <Text style={styles.deletedOverlayText}>{t('car.no_longer_available', 'No longer available')}</Text>
          </View>
        )}
      </View>
      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isDeleted && { opacity: 0.5 }]} numberOfLines={1}>
            {car.make} {car.model}
          </Text>
          {!isDeleted && (
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={22} color={isDarkMode ? '#FFB385' : '#D55004'} style={styles.chevron} />
          )}
        </View>
        <View style={styles.specRow}>
          <View style={styles.specItem}>
            <Ionicons name="calendar-outline" size={16} color={isDarkMode ? '#bbb' : '#888'} />
            <Text style={styles.specText}>{car.year}</Text>
          </View>
          <View style={styles.specItem}>
            <MaterialCommunityIcons name="highway" size={16} color={isDarkMode ? '#bbb' : '#888'} />
            <Text style={styles.specText}>{formatMileage(car.mileage)}</Text>
          </View>
          <View style={styles.specItem}>
            <MaterialCommunityIcons name="car-shift-pattern" size={16} color={isDarkMode ? '#bbb' : '#888'} />
            <Text style={styles.specText}>{car.transmission === 'Automatic' ? 'Auto' : car.transmission === 'Manual' ? 'Manual' : car.transmission}</Text>
          </View>
          <View style={styles.specItem}>
            <MaterialCommunityIcons name="car-wrench" size={16} color={isDarkMode ? '#bbb' : '#888'} />
            <Text style={styles.specText}>{car.condition}</Text>
          </View>
        </View>
        <View style={styles.dealerRow}>
          {car.dealership_logo ? (
            <CachedImage source={{ uri: car.dealership_logo }} style={styles.dealerLogo} cachePolicy="disk" />
          ) : null}
          <View style={styles.dealerInfo}>
            <Text style={styles.dealerName} numberOfLines={1}>{car.dealership_name}</Text>
            <Text style={styles.dealerLocation} numberOfLines={1}>{car.dealership_location}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (isDarkMode: boolean, isRTL: boolean, isDeleted: boolean = false) => StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: isDarkMode ? '#232323' : '#fff',
    borderRadius: 18,
    ...(isRTL ? { marginLeft: 16 } : { marginRight: 16 }),
    shadowColor: isDarkMode ? '#000' : '#000',
    shadowOpacity: isDarkMode ? 0.25 : 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    borderWidth: isDarkMode ? 1 : 0,
    borderColor: isDeleted ? '#666' : (isDarkMode ? '#333' : undefined),
    opacity: isDeleted ? 0.7 : 1,
  },
  imageContainer: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    backgroundColor: isDarkMode ? '#333' : '#eee',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  priceBadge: {
    position: 'absolute',
    top: 10,
    ...(isRTL ? { left: 10 } : { right: 10 }),
    backgroundColor: isDarkMode ? '#D55004' : '#D55004',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 2,
  },
  priceText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  infoContainer: {
    padding: 12,
  },
  titleRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    flex: 1,
    color: isDarkMode ? '#fff' : '#222',
    textAlign: isRTL ? 'right' : 'left',
  },
  chevron: {
    ...(isRTL ? { marginRight: 6 } : { marginLeft: 6 }),
  },
  specRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 2,
  },
  specItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    ...(isRTL ? { marginLeft: 8 } : { marginRight: 8 }),
  },
  specText: {
    fontSize: 13,
    color: isDarkMode ? '#ccc' : '#555',
    ...(isRTL ? { marginRight: 3 } : { marginLeft: 3 }),
  },
  dealerRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dealerLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    ...(isRTL ? { marginLeft: 8 } : { marginRight: 8 }),
    backgroundColor: isDarkMode ? '#444' : '#eee',
  },
  dealerInfo: {
    flex: 1,
  },
  dealerName: {
    fontSize: 13,
    fontWeight: '600',
    color: isDarkMode ? '#fff' : '#333',
    textAlign: isRTL ? 'right' : 'left',
  },
  dealerLocation: {
    fontSize: 12,
    color: isDarkMode ? '#aaa' : '#888',
    marginTop: 1,
    textAlign: isRTL ? 'right' : 'left',
  },
  deletedBadge: {
    position: 'absolute',
    top: 10,
    ...(isRTL ? { left: 10 } : { right: 10 }),
    backgroundColor: '#666',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 2,
  },
  deletedText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  deletedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deletedOverlayText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
}); 
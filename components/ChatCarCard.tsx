import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';

interface ChatCarCardProps {
  car: any;
  onPress: () => void;
}

export default function ChatCarCard({ car, onPress }: ChatCarCardProps) {
  const { isDarkMode } = useTheme();
  const styles = getStyles(isDarkMode);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: car.images?.[0] || '' }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>${car.price?.toLocaleString() || 'N/A'}</Text>
        </View>
      </View>
      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {car.make} {car.model}
          </Text>
          <Ionicons name="chevron-forward" size={22} color={isDarkMode ? '#FFB385' : '#D55004'} style={styles.chevron} />
        </View>
        <View style={styles.specRow}>
          <View style={styles.specItem}>
            <Ionicons name="calendar-outline" size={16} color={isDarkMode ? '#bbb' : '#888'} />
            <Text style={styles.specText}>{car.year}</Text>
          </View>
          <View style={styles.specItem}>
            <MaterialCommunityIcons name="highway" size={16} color={isDarkMode ? '#bbb' : '#888'} />
            <Text style={styles.specText}>{(car.mileage / 1000).toFixed(1)}k</Text>
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
            <Image source={{ uri: car.dealership_logo }} style={styles.dealerLogo} />
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

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: isDarkMode ? '#232323' : '#fff',
    borderRadius: 18,
    marginRight: 16,
    shadowColor: isDarkMode ? '#000' : '#000',
    shadowOpacity: isDarkMode ? 0.25 : 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    borderWidth: isDarkMode ? 1 : 0,
    borderColor: isDarkMode ? '#333' : undefined,
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
    right: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    flex: 1,
    color: isDarkMode ? '#fff' : '#222',
  },
  chevron: {
    marginLeft: 6,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 2,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  specText: {
    fontSize: 13,
    color: isDarkMode ? '#ccc' : '#555',
    marginLeft: 3,
  },
  dealerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dealerLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: isDarkMode ? '#444' : '#eee',
  },
  dealerInfo: {
    flex: 1,
  },
  dealerName: {
    fontSize: 13,
    fontWeight: '600',
    color: isDarkMode ? '#fff' : '#333',
  },
  dealerLocation: {
    fontSize: 12,
    color: isDarkMode ? '#aaa' : '#888',
    marginTop: 1,
  },
}); 
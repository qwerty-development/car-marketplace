import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useState, useMemo } from "react";
import { TouchableOpacity, View, TextInput, ScrollView, Text, Image, StyleSheet } from "react-native";
import { SlideInDown, SlideOutDown, FadeIn, FadeOut } from "react-native-reanimated";
import { Car } from "./types";
import styles from "./styles";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics"

export const CarPickerModal = ({
    visible,
    onClose,
    cars,
    onSelect,
    selectedCars,
    isDarkMode,
    position
  }: {
    visible: boolean;
    onClose: () => void;
    cars: Car[];
    onSelect: (car: Car, position: 'left' | 'right') => void;
    selectedCars: [Car | null, Car | null];
    isDarkMode: boolean;
    position: 'left' | 'right';
  }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState('make');
    const sortOptions = [
      { value: 'make', label: 'Make' },
      { value: 'price_asc', label: 'Price (Low to High)' },
      { value: 'price_desc', label: 'Price (High to Low)' },
      { value: 'year_desc', label: 'Year (Newest First)' },
      { value: 'year_asc', label: 'Year (Oldest First)' },
    ];
  
    // Filter and sort cars
    const filteredAndSortedCars = useMemo(() => {
      // First filter by search query
      let filtered = cars;
  
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = cars.filter(car =>
          car.make.toLowerCase().includes(query) ||
          car.model.toLowerCase().includes(query) ||
          car.year.toString().includes(query) ||
          car.category?.toLowerCase().includes(query) ||
          car.dealership_name?.toLowerCase().includes(query)
        );
      }
  
      // Then sort
      return [...filtered].sort((a, b) => {
        switch(sortOption) {
          case 'price_asc':
            return a.price - b.price;
          case 'price_desc':
            return b.price - a.price;
          case 'year_desc':
            return b.year - a.year;
          case 'year_asc':
            return a.year - b.year;
          case 'make':
          default:
            return a.make.localeCompare(b.make);
        }
      });
    }, [cars, searchQuery, sortOption]);
  
  
  
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <BlurView
          style={styles.modalBlurContainer}
          intensity={isDarkMode ? 30 : 20}
          tint={isDarkMode ? 'dark' : 'light'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={onClose}
          />
  
          <Animated.View
            entering={SlideInDown}
            exiting={SlideOutDown}
            style={[
              styles.modalContent,
              {
                backgroundColor: isDarkMode ? '#121212' : '#ffffff',
                height: '75%',
              }
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandleBar} />
  
              <Text style={[
                styles.modalTitle,
                { color: isDarkMode ? '#ffffff' : '#000000' }
              ]}>
                Select Car for {position === 'left' ? 'Left' : 'Right'} Position
              </Text>
  
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDarkMode ? '#ffffff' : '#000000'}
                />
              </TouchableOpacity>
            </View>
  
            {/* Search and sort options */}
            <View style={styles.searchSortContainer}>
              <View style={[
                styles.searchInputContainer,
                {
                  backgroundColor: isDarkMode ? '#333333' : '#f0f0f0',
                  borderColor: isDarkMode ? '#444444' : '#e0e0e0'
                }
              ]}>
                <Ionicons
                  name="search"
                  size={20}
                  color={isDarkMode ? '#bbbbbb' : '#666666'}
                />
                <TextInput
                  style={[
                    styles.searchInput,
                    { color: isDarkMode ? '#ffffff' : '#000000' }
                  ]}
                  placeholder="Search cars..."
                  placeholderTextColor={isDarkMode ? '#888888' : '#aaaaaa'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={isDarkMode ? '#bbbbbb' : '#666666'}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
  
              <View style={styles.sortContainer}>
                <Text style={[
                  styles.sortLabel,
                  { color: isDarkMode ? '#bbbbbb' : '#666666' }
                ]}>
                  Sort by:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sortOptionsContainer}
                >
                  {sortOptions.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.sortOption,
                        sortOption === option.value && styles.sortOptionActive,
                        {
                          backgroundColor: isDarkMode ?
                            (sortOption === option.value ? '#D55004' : '#333333') :
                            (sortOption === option.value ? '#D55004' : '#f0f0f0'),
                        }
                      ]}
                      onPress={() => setSortOption(option.value)}
                    >
                      <Text style={[
                        styles.sortOptionText,
                        {
                          color: sortOption === option.value ?
                            '#ffffff' :
                            (isDarkMode ? '#ffffff' : '#333333')
                        }
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
  
            {/* Car list */}
            {filteredAndSortedCars.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons
                  name="car-sport-outline"
                  size={48}
                  color={isDarkMode ? '#555555' : '#cccccc'}
                />
                <Text style={[
                  styles.emptyStateText,
                  { color: isDarkMode ? '#aaaaaa' : '#666666' }
                ]}>
                  {searchQuery ?
                    'No cars match your search' :
                    'No favorite cars available to compare'}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.carList}
                showsVerticalScrollIndicator={false}
              >
                {filteredAndSortedCars.map((car) => {
                  // Check if car is already selected in the other position
                  const isSelectedInOtherPosition =
                    (position === 'left' && selectedCars[1]?.id === car.id) ||
                    (position === 'right' && selectedCars[0]?.id === car.id);
  
                  return (
                    <TouchableOpacity
                      key={car.id}
                      style={[
                        styles.carItem,
                        {
                          backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
                          opacity: isSelectedInOtherPosition ? 0.5 : 1,
                          borderColor: isDarkMode ? '#333333' : '#dddddd',
                        }
                      ]}
                      onPress={() => {
                        if (!isSelectedInOtherPosition) {
                          // Add haptic feedback
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onSelect(car, position);
                          onClose();
                        }
                      }}
                      disabled={isSelectedInOtherPosition}
                    >
                      <Image
                        source={{ uri: car.images[0] }}
                        style={styles.carThumbnail}
                      />
                      <View style={styles.carInfo}>
                        <Text style={[
                          styles.carMake,
                          { color: isDarkMode ? '#D55004' : '#D55004' }
                        ]}>
                          {car.make}
                        </Text>
                        <Text style={[
                          styles.carTitle,
                          { color: isDarkMode ? '#ffffff' : '#000000' }
                        ]}>
                          {car.year} {car.model}
                        </Text>
                        <Text style={[
                          styles.carPrice,
                          { color: isDarkMode ? '#ffffff' : '#000000' }
                        ]}>
                          ${car.price.toLocaleString()}
                        </Text>
                        <View style={styles.carMeta}>
                          <Text style={[
                            styles.carMetaItem,
                            { color: isDarkMode ? '#bbbbbb' : '#666666' }
                          ]}>
                            <Ionicons name="speedometer-outline" size={12} color={isDarkMode ? '#bbbbbb' : '#666666'} /> {car.mileage.toLocaleString()} km
                          </Text>
                          <Text style={[
                            styles.carMetaItem,
                            { color: isDarkMode ? '#bbbbbb' : '#666666' }
                          ]}>
                            <Ionicons name="cog-outline" size={12} color={isDarkMode ? '#bbbbbb' : '#666666'} /> {car.transmission}
                          </Text>
                        </View>
  
                        {/* Feature count badge */}
                        <View style={[
                          styles.featureCountBadge,
                          { backgroundColor: isDarkMode ? '#333333' : '#eeeeee' }
                        ]}>
                          <MaterialCommunityIcons
                            name="feature-search"
                            size={12}
                            color={isDarkMode ? '#bbbbbb' : '#666666'}
                          />
                          <Text style={[
                            styles.featureCountText,
                            { color: isDarkMode ? '#bbbbbb' : '#666666' }
                          ]}>
                            {car.features?.length || 0} features
                          </Text>
                        </View>
                      </View>
                      {
                        isSelectedInOtherPosition && (
                          <View style={styles.alreadySelectedBadge}>
                            <Text style={styles.alreadySelectedText}>Already Selected</Text>
                          </View>
                        )
                      }
                    </TouchableOpacity>
                  );
                })}
                <View style={{ height: 50 }} />
              </ScrollView>
            )}
          </Animated.View>
        </BlurView>
      </Modal>
    );
  };
  
  // Custom Modal component
  export const Modal = ({
    visible,
    children,
    animationType = 'fade',
    transparent = true,
  }: {
    visible: boolean;
    children: React.ReactNode;
    animationType?: 'fade' | 'slide';
    transparent?: boolean;
  }) => {
    if (!visible) return null;
  
    return (
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { zIndex: 1000 }
        ]}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
      >
        {children}
      </Animated.View>
    );
  };
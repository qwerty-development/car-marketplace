import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { supabase } from "@/utils/supabase";
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

interface TrimDropdownProps {
  make: string;
  model: string;
  value: string | null;
  onChange: (trim: string) => void;
  isDarkMode: boolean;
}

export const TrimDropdown: React.FC<TrimDropdownProps> = ({
  make,
  model,
  value,
  onChange,
  isDarkMode,
}) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [trims, setTrims] = useState<string[]>([]);
  const [filteredTrims, setFilteredTrims] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const modalAnimation = useSharedValue(0);
  const searchFocused = useSharedValue(0);

  // Normalize the value prop to ensure it's always a string or null
  const normalizedValue = React.useMemo(() => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    // If somehow an array or object is passed, return null to avoid crashes
    console.warn('TrimDropdown: Expected string value but received:', typeof value, value);
    return null;
  }, [value]);

  // Fetch trims when make or model changes
  useEffect(() => {
    if (make && model) {
      fetchTrims();
    } else {
      setTrims([]);
      setFilteredTrims([]);
      setError(null);
    }
  }, [make, model]);

  // Filter trims based on search
  useEffect(() => {
    console.log(`🔄 TrimDropdown: Filtering trims. Search: "${searchQuery}", All trims:`, trims);
    if (searchQuery.trim() === "") {
      setFilteredTrims(trims);
      console.log(`✅ TrimDropdown: No search, using all trims:`, trims);
    } else {
      const filtered = trims.filter((trim) =>
        trim.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTrims(filtered);
      console.log(`✅ TrimDropdown: Filtered trims:`, filtered);
    }
  }, [trims, searchQuery]);

  const fetchTrims = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`🔍 TrimDropdown: Fetching trims for make: "${make}", model: "${model}"`);
      
      // Add input validation
      if (!make || !model || typeof make !== 'string' || typeof model !== 'string') {
        throw new Error('Invalid make or model provided');
      }
      
      // Query with error handling
      const { data, error: queryError } = await supabase
        .from("allcars")
        .select("trim")
        .eq("make", make)
        .eq("model", model)
        .not("trim", "is", null);

      if (queryError) {
        console.error("❌ TrimDropdown: Supabase query error:", queryError);
        throw queryError;
      }

      console.log(`📊 TrimDropdown: Found ${data?.length || 0} cars with trims for ${make} ${model}`);

      if (!data || data.length === 0) {
        console.log(`📊 TrimDropdown: No cars found with trims for ${make} ${model}`);
        setTrims([]);
        setFilteredTrims([]);
        return;
      }

      // Enhanced trim extraction with better error handling
      const allTrims: string[] = [];
      
      data.forEach((car, index) => {
        console.log(`🔧 TrimDropdown: Processing car ${index + 1}:`, car);
        
        try {
          let trimArray: string[] = [];
          
          if (car.trim) {
            if (Array.isArray(car.trim)) {
              // Already an array
              trimArray = car.trim.filter(trim => 
                typeof trim === 'string' && trim.trim().length > 0
              );
              console.log(`✅ TrimDropdown: Car ${index + 1} has array trim:`, trimArray);
            } else if (typeof car.trim === 'string') {
              // Try to parse as JSON first
              if (car.trim.startsWith('[') || car.trim.startsWith('{')) {
                try {
                  const parsed = JSON.parse(car.trim);
                  if (Array.isArray(parsed)) {
                    trimArray = parsed.filter(trim => 
                      typeof trim === 'string' && trim.trim().length > 0
                    );
                    console.log(`✅ TrimDropdown: Car ${index + 1} parsed JSON trim:`, trimArray);
                  }
                } catch (parseError) {
                  console.log(`⚠️ TrimDropdown: Car ${index + 1} JSON parse failed, treating as string:`, car.trim);
                  // If JSON parsing fails, treat as single trim
                  if (car.trim.trim().length > 0) {
                    trimArray = [car.trim.trim()];
                  }
                }
              } else {
                // Regular string, treat as single trim
                if (car.trim.trim().length > 0) {
                  trimArray = [car.trim.trim()];
                }
                console.log(`✅ TrimDropdown: Car ${index + 1} string trim:`, trimArray);
              }
            } else {
              console.log(`⚠️ TrimDropdown: Car ${index + 1} has unexpected trim type:`, typeof car.trim, car.trim);
            }
            
            // Add valid trims to the collection
            if (Array.isArray(trimArray) && trimArray.length > 0) {
              allTrims.push(...trimArray);
              console.log(`➕ TrimDropdown: Added ${trimArray.length} trims from car ${index + 1}`);
            }
          } else {
            console.log(`❌ TrimDropdown: Car ${index + 1} has null/undefined trim`);
          }
        } catch (carError) {
          console.error(`❌ TrimDropdown: Error processing car ${index + 1}:`, carError);
          // Continue processing other cars even if one fails
        }
      });

      console.log(`🎯 TrimDropdown: All trims collected:`, allTrims);

      // Remove duplicates, filter empty strings, and sort
      const uniqueTrims = [...new Set(allTrims)]
        .filter(trim => trim && trim.length > 0)
        .sort();
      
      console.log(`🏁 TrimDropdown: Final unique trims:`, uniqueTrims);
      
      setTrims(uniqueTrims);
      setFilteredTrims(uniqueTrims);
      
    } catch (error) {
      console.error("❌ TrimDropdown: Error fetching trims:", error);
      setError(error instanceof Error ? error.message : 'Failed to fetch trims');
      setTrims([]);
      setFilteredTrims([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTrim = useCallback((trim: string) => {
    console.log(`🎯 TrimDropdown: Trim selected:`, trim);
    if (typeof trim === 'string' && trim.length > 0) {
      onChange(trim);
      closeModal();
      setSearchQuery("");
    }
  }, [onChange]);

  const openModal = () => {
    console.log(`🔴 TrimDropdown: Opening modal. Current trims:`, trims, `Filtered:`, filteredTrims);
    setShowModal(true);
    modalAnimation.value = withSpring(1, {
      damping: 20,
      stiffness: 100,
    });
  };

  const closeModal = () => {
    modalAnimation.value = withTiming(0, { duration: 200 });
    setTimeout(() => {
      setShowModal(false);
      setSearchQuery("");
    }, 200);
  };

  const modalStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      modalAnimation.value,
      [0, 1],
      [SCREEN_HEIGHT, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateY }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      modalAnimation.value,
      [0, 1],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity,
    };
  });

  const searchStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      searchFocused.value,
      [0, 1],
      [1, 1.02],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }],
    };
  });

  // Don't render if no make/model provided, if there's an error, or if we've finished loading and found no trims
  if (!make || !model || error || (!isLoading && trims.length === 0)) {
    console.log(`🚫 TrimDropdown: Not rendering. make: ${make}, model: ${model}, error: ${error}, isLoading: ${isLoading}, trims.length: ${trims.length}`);
    return null;
  }

  console.log(`🎯 TrimDropdown: Rendering component. trims: ${trims.length}, filteredTrims: ${filteredTrims.length}, isLoading: ${isLoading}`);

  return (
    <View className="mb-6">
      <Text
        className={`text-sm font-medium mb-3 ${
          isDarkMode ? "text-neutral-300" : "text-neutral-700"
        }`}
      >
        Trim
      </Text>
      
      <TouchableOpacity
        onPress={openModal}
        className={`rounded-2xl overflow-hidden ${
          isDarkMode ? "bg-[#1c1c1c]" : "bg-[#f5f5f5]"
        }`}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <BlurView
          intensity={isDarkMode ? 20 : 40}
          tint={isDarkMode ? "dark" : "light"}
          className="flex-row items-center justify-between p-4"
        >
          <View className="flex-row items-center flex-1">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                normalizedValue ? "bg-[#D55004]/20" : isDarkMode ? "bg-neutral-700" : "bg-neutral-300"
              }`}
            >
              <MaterialCommunityIcons
                name="car-settings"
                size={20}
                color={normalizedValue ? "#D55004" : isDarkMode ? "#fff" : "#000"}
              />
            </View>
            <Text
              className={`ml-3 text-base flex-1 ${
                normalizedValue
                  ? isDarkMode
                    ? "text-white font-medium"
                    : "text-black font-medium"
                  : isDarkMode
                  ? "text-neutral-400"
                  : "text-neutral-500"
              }`}
            >
              {normalizedValue || t('common.select_trim')}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-down"
            size={20}
            color={isDarkMode ? "#fff" : "#000"}
          />
        </BlurView>
      </TouchableOpacity>

      {normalizedValue && (
        <Animated.View
          className={`mt-3 p-4 rounded-xl border-2 ${
            isDarkMode
              ? "bg-neutral-800/50 border-[#D55004]/20"
              : "bg-neutral-50 border-[#D55004]/20"
          }`}
        >
          <View className="flex-row items-center">
            <View className="w-6 h-6 bg-green-500 rounded-full items-center justify-center mr-3">
              <MaterialCommunityIcons
                name="check"
                size={14}
                color="white"
              />
            </View>
            <Text
              className={`flex-1 font-medium ${
                isDarkMode ? "text-white" : "text-black"
              }`}
            >
              {normalizedValue}
            </Text>
            <TouchableOpacity
              onPress={() => onChange("")}
              className="w-8 h-8 rounded-full bg-red-500/10 items-center justify-center"
            >
              <Ionicons
                name="close"
                size={16}
                color="#EF4444"
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Enhanced Modal */}
      <Modal
        visible={showModal}
        animationType="none"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={closeModal}
      >
        <View style={{ flex: 1 }}>
          {/* Animated Backdrop */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
              },
              backdropStyle,
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={closeModal}
            />
          </Animated.View>

          {/* Modal Content */}
          <Animated.View
            style={[
              {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                maxHeight: SCREEN_HEIGHT * 0.85,
                minHeight: SCREEN_HEIGHT * 0.6,
              },
              modalStyle,
            ]}
          >
            <BlurView
              intensity={isDarkMode ? 30 : 20}
              tint={isDarkMode ? "dark" : "light"}
              style={{ flex: 1 }}
              className={`rounded-t-3xl overflow-hidden ${
                isDarkMode ? "bg-black/95" : "bg-white/95"
              }`}
            >
              {/* Modal Handle */}
              <View className="items-center pt-3 pb-2">
                <View
                  className={`w-12 h-1 rounded-full ${
                    isDarkMode ? "bg-neutral-600" : "bg-neutral-300"
                  }`}
                />
              </View>

              {/* Header */}
              <View className="px-6 py-4 border-b border-neutral-200/10">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text
                      className={`text-xl font-bold ${
                        isDarkMode ? "text-white" : "text-black"
                      }`}
                    >
                      {t('common.select_trim')}
                    </Text>
                    <Text
                      className={`text-sm mt-1 ${
                        isDarkMode ? "text-neutral-400" : "text-neutral-600"
                      }`}
                    >
                      {make} {model} • {filteredTrims.length} options
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={closeModal}
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      isDarkMode ? "bg-neutral-800" : "bg-neutral-100"
                    }`}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={isDarkMode ? "#fff" : "#000"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Bar */}
              <View className="px-6 py-4">
                <Animated.View style={searchStyle}>
                  <View
                    className={`flex-row items-center px-4 py-3 rounded-2xl border ${
                      isDarkMode
                        ? "bg-neutral-800/50 border-neutral-700"
                        : "bg-neutral-100 border-neutral-200"
                    }`}
                  >
                    <MaterialCommunityIcons
                      name="magnify"
                      size={20}
                      color={isDarkMode ? "#9CA3AF" : "#6B7280"}
                    />
                    <TextInput
                      style={{
                        flex: 1,
                        marginLeft: 12,
                        color: isDarkMode ? "#fff" : "#000",
                        fontSize: 16,
                      }}
                      placeholder="Search trim..."
                      placeholderTextColor={isDarkMode ? "#6B7280" : "#9CA3AF"}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onFocus={() => (searchFocused.value = withSpring(1))}
                      onBlur={() => (searchFocused.value = withSpring(0))}
                    />
                    {searchQuery ? (
                      <TouchableOpacity
                        onPress={() => setSearchQuery("")}
                        className="w-6 h-6 rounded-full bg-neutral-500/20 items-center justify-center"
                      >
                        <Ionicons
                          name="close"
                          size={14}
                          color={isDarkMode ? "#fff" : "#000"}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </Animated.View>
              </View>

              {/* Content */}
              {isLoading ? (
                <View className="flex-1 justify-center items-center py-12">
                  <ActivityIndicator size="large" color="#D55004" />
                  <Text
                    className={`mt-4 text-base ${
                      isDarkMode ? "text-neutral-400" : "text-neutral-600"
                    }`}
                  >
                    Loading trim...
                  </Text>
                </View>
              ) : (
                <ScrollView
                  className="flex-1 px-6"
                  contentContainerStyle={{ paddingBottom: 32 }}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredTrims.length > 0 ? (
                    <View className="space-y-2">
                      {filteredTrims.map((trim, index) => {
                        const isSelected = normalizedValue === trim;
                        console.log(`🎨 TrimDropdown: Rendering trim ${index + 1}:`, trim);
                        
                        return (
                          <TouchableOpacity
                            key={`trim-${index}-${trim}`}
                            onPress={() => handleSelectTrim(trim)}
                            className={`p-4 rounded-2xl border-2 mb-3 ${
                              isSelected
                                ? "bg-[#D55004] border-[#D55004]"
                                : isDarkMode
                                ? "bg-neutral-800/50 border-neutral-700"
                                : "bg-neutral-50 border-neutral-200"
                            }`}
                            style={{
                              shadowColor: isSelected ? "#D55004" : "#000",
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: isSelected ? 0.3 : 0.1,
                              shadowRadius: 8,
                              elevation: isSelected ? 6 : 2,
                            }}
                          >
                            <View className="flex-row items-center justify-between">
                              <View className="flex-1">
                                <Text
                                  className={`text-lg font-semibold ${
                                    isSelected
                                      ? "text-white"
                                      : isDarkMode
                                      ? "text-white"
                                      : "text-black"
                                  }`}
                                >
                                  {trim}
                                </Text>
                              </View>
                              {isSelected && (
                                <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center">
                                  <MaterialCommunityIcons
                                    name="check"
                                    size={18}
                                    color="white"
                                  />
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View className="flex-1 justify-center items-center py-16">
                      <View
                        className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${
                          isDarkMode ? "bg-neutral-800" : "bg-neutral-100"
                        }`}
                      >
                        <MaterialCommunityIcons
                          name="car-off"
                          size={36}
                          color={isDarkMode ? "#6B7280" : "#9CA3AF"}
                        />
                      </View>
                      <Text
                        className={`text-lg font-semibold mb-2 ${
                          isDarkMode ? "text-white" : "text-black"
                        }`}
                      >
                        No Trims Found
                      </Text>
                      <Text
                        className={`text-center px-8 ${
                          isDarkMode ? "text-neutral-400" : "text-neutral-600"
                        }`}
                      >
                        {searchQuery
                          ? `No trim levels match "${searchQuery}"`
                          : t('common.no_trim_levels_available')}
                      </Text>
                      {searchQuery && (
                        <TouchableOpacity
                          onPress={() => setSearchQuery("")}
                          className="mt-4 px-6 py-3 bg-[#D55004] rounded-2xl"
                        >
                          <Text className="text-white font-medium">
                            Clear Search
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </ScrollView>
              )}
            </BlurView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};
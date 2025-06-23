import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Platform,
  Modal,
  Dimensions,
  StatusBar
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { supabase } from "@/utils/supabase";
import { useTheme } from "@/utils/ThemeContext";
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  useSharedValue,
  runOnJS,
  withSpring,
  Easing
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 1,
};

interface Suggestions {
  makes: string[];
  models: string[];
}

interface SearchModalProps {
  isVisible: boolean;
  onClose: () => void;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  initialQuery?: string;
  onSearch: (query: string) => void;
}

    const getLogoUrl = useCallback((make: string, isLightMode: boolean) => {
      const formattedMake = make.toLowerCase().replace(/\s+/g, "-");
      switch (formattedMake) {
        case "range-rover":
          return isLightMode
            ? "https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png"
            : "https://www.carlogos.org/car-logos/land-rover-logo.png";
        case "infiniti":
          return "https://www.carlogos.org/car-logos/infiniti-logo.png";
        case "jetour":
          return "https://1000logos.net/wp-content/uploads/2023/12/Jetour-Logo.jpg";
        case "audi":
          return "https://www.freepnglogos.com/uploads/audi-logo-2.png";
        case "nissan":
          return "https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png";
        case "deepal":
          return "https://www.chinacarstrading.com/wp-content/uploads/2023/04/deepal-logo2.png";
        case "denza":
          return "https://upload.wikimedia.org/wikipedia/en/5/5e/Denza_logo.png";
        case "voyah":
          return "https://i0.wp.com/www.caradviser.io/wp-content/uploads/2024/07/VOYAH.png?fit=722%2C722&ssl=1";
        case "rox":
          return "https://contactcars.fra1.cdn.digitaloceanspaces.com/contactcars-production/Images/Large/Makes/f64aa1a8-fb87-4028-b60e-7128f4588f5e_202502061346164286.jpg";
        case "xiaomi":
          return "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Xiaomi_logo_%282021-%29.svg/1024px-Xiaomi_logo_%282021-%29.svg.png";
        default:
          return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`;
      }
    }, []);

export default function SearchModal({
    isVisible,
    onClose,
    user,
    initialQuery = "",
    onSearch
  }: SearchModalProps) {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestions>({
    makes: [],
    models: [],
  });
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Animation values
  const translateY = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const animationProgress = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      // Set initial query if provided
      if (initialQuery) {
        setSearchQuery(initialQuery);
        // Fetch suggestions immediately for the initial query
        fetchSuggestions(initialQuery);
      } else {
        setSearchQuery('');
        setShowSuggestions(false);
      }
    }
  }, [isVisible, initialQuery]);



  // Gesture handling

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { 
          scale: animationProgress.value * 0.02 + 0.98 
        }
      ],
      opacity: 1 - (translateY.value / SCREEN_HEIGHT)
    };
  });

  useEffect(() => {
    if (isVisible) {
      setSearchQuery('');
      setShowSuggestions(false);
    }
  }, [isVisible]);

  useEffect(() => {
    if (user?.id) {
      fetchRecentSearches();
    }
  }, [user]);

  const fetchRecentSearches = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("recent_searches")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data?.recent_searches) {
        setRecentSearches(data.recent_searches);
      }
    } catch (err) {
      console.error("Error fetching recent searches:", err);
    }
  };

  const storeSearchQuery = async (newQuery: string) => {
    if (!user?.id || !newQuery.trim()) return;

    const filtered = recentSearches.filter((q) => q !== newQuery);
    const updated = [newQuery, ...filtered].slice(0, 4);

    try {
      const { error } = await supabase
        .from("users")
        .update({ recent_searches: updated })
        .eq("id", user.id);

      if (error) throw error;
      setRecentSearches(updated);
    } catch (err) {
      console.error("Error updating recent searches:", err);
    }
  };

  const fetchSuggestions = async (query: string = searchQuery) => {
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) {
      setSuggestions({ makes: [], models: [] });
      setShowSuggestions(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("cars")
        .select("make, model")
        .or(`make.ilike.%${trimmedQuery}%,model.ilike.%${trimmedQuery}%`)
        .limit(20);

      if (error) throw error;

      const makesSet = new Set<string>();
      const modelsSet = new Set<string>();

      data.forEach((row: any) => {
        if (row.make?.toLowerCase().includes(trimmedQuery.toLowerCase())) {
          makesSet.add(row.make);
        }
        if (row.model?.toLowerCase().includes(trimmedQuery.toLowerCase())) {
          modelsSet.add(row.model);
        }
      });

      let makes = Array.from(makesSet);
      let models = Array.from(modelsSet);

      // If exact make match, fetch all models for that make
      if (makes.length === 1 && makes[0].toLowerCase() === trimmedQuery.toLowerCase()) {
        const { data: modelsData } = await supabase
          .from("cars")
          .select("model")
          .eq("make", makes[0])
          .limit(20);

        if (modelsData) {
          const extraModels = new Set<string>();
          modelsData.forEach((row: any) => {
            if (row.model) extraModels.add(row.model);
          });
          models = Array.from(extraModels);
        }
      }

      setSuggestions({ makes, models });
      setShowSuggestions(makes.length > 0 || models.length > 0);
    } catch (err) {
      console.error("Error in suggestions:", err);
      setSuggestions({ makes: [], models: [] });
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchSuggestions();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, fetchSuggestions]);

  const handleSearchSubmit = async () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      await storeSearchQuery(trimmedQuery);
    }
    onSearch(trimmedQuery);
    onClose();
  };

  const handleSuggestionPress = async (suggestion: string) => {
    const trimmedQuery = suggestion.trim();
    if (trimmedQuery) {
      setSearchQuery(trimmedQuery);
      await storeSearchQuery(trimmedQuery);
    }
    onSearch(trimmedQuery);
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.container,
              isDarkMode && styles.darkContainer,
              animatedStyle
            ]}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.backButton}>
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={isDarkMode ? "#fff" : "#000"}
                />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>
                Search
              </Text>
            </View>

            <View style={[styles.searchBox, isDarkMode && styles.darkSearchBox]}>
              <FontAwesome
                name="search"
                size={20}
                color={isDarkMode ? "#ccc" : "#666"}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, isDarkMode && styles.darkSearchInput]}
                placeholder="Search cars..."
                placeholderTextColor={isDarkMode ? "#666" : "#999"}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  style={styles.clearButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={isDarkMode ? "#666" : "#999"}
                  />
                </TouchableOpacity>
              )}
            </View>

            {recentSearches.length > 0 && !searchQuery && (
              <View style={styles.recentSearchesContainer}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
                  Recent Searches
                </Text>
                <FlatList
                  data={recentSearches}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.recentSearchItem, isDarkMode && styles.darkRecentSearchItem]}
                      onPress={() => handleSuggestionPress(item)}
                    >
                      <View style={styles.recentSearchContent}>
                        <Ionicons
                          name="time-outline"
                          size={20}
                          color={isDarkMode ? "#fff" : "#666"}
                          style={styles.recentSearchIcon}
                        />
                        <Text style={[styles.recentSearchText, isDarkMode && styles.darkText]}>
                          {item}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item}
                  style={styles.recentSearchesList}
                />
              </View>
            )}

            {showSuggestions && (suggestions.makes.length > 0 || suggestions.models.length > 0) && (
              <View style={styles.suggestionsContainer}>
                {suggestions.makes.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
                      Makes
                    </Text>
                    {suggestions.makes.map((make, index) => (
                      <TouchableOpacity
                        key={`make-${index}`}
                        style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
                        onPress={() => handleSuggestionPress(make)}
                      >
                        <Image
                          source={{ uri: getLogoUrl(make, !isDarkMode) }}
                          style={styles.brandLogo}
                          resizeMode="contain"
                        />
                        <Text style={[styles.suggestionText, isDarkMode && styles.darkText]}>
                          {make}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {suggestions.models.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
                      Models
                    </Text>
                    {suggestions.models.map((model, index) => (
                      <TouchableOpacity
                        key={`model-${index}`}
                        style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
                        onPress={() => handleSuggestionPress(model)}
                      >
                        <Text style={[styles.suggestionText, isDarkMode && styles.darkText]}>
                          {model}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}
          </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'ios' ? 40 : StatusBar.currentHeight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginLeft: 8,
    color: '#000',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
  },
  darkSearchBox: {
    backgroundColor: '#222',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  darkSearchInput: {
    color: '#fff',
  },
  clearButton: {
    padding: 8,
  },
  recentSearchesContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  recentSearchesList: {
    marginTop: 8,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkRecentSearchItem: {
    borderBottomColor: '#222',
  },
  recentSearchContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentSearchIcon: {
    marginRight: 12,
  },
  recentSearchText: {
    fontSize: 16,
    color: '#000',
  },
  suggestionsContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  suggestionText: {
    fontSize: 16,
  },
    darkSuggestionItem: {
      borderBottomColor: '#222',
      backgroundColor: '#111',
    },
    
  brandLogo: {
    width: 24,
    height: 24,
  },
  darkText: {
    color: '#fff',
  },
  
});
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
import { getLogoUrl } from "@/hooks/getLogoUrl";

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
      // Get all makes and models that match the query
      const { data, error } = await supabase
        .from("cars")
        .select("make, model")
        .or(`make.ilike.%${trimmedQuery}%,model.ilike.%${trimmedQuery}%`)
        .eq("status", "available")
        .limit(50); // Increased limit for better scoring

      if (error) throw error;

      const makesMap = new Map<string, number>();
      const modelsMap = new Map<string, number>();
      const queryLower = trimmedQuery.toLowerCase();

      // Score and collect unique makes and models
      data.forEach((row: any) => {
        if (row.make?.trim()) {
          const makeLower = row.make.toLowerCase();
          let score = 0;
          
          // Exact match gets highest score
          if (makeLower === queryLower) {
            score = 1000;
          }
          // Starts with query gets high score
          else if (makeLower.startsWith(queryLower)) {
            score = 500;
          }
          // Contains query gets lower score
          else if (makeLower.includes(queryLower)) {
            score = 100;
          }
          
          if (score > 0) {
            makesMap.set(row.make, Math.max(makesMap.get(row.make) || 0, score));
          }
        }
        
        if (row.model?.trim()) {
          const modelLower = row.model.toLowerCase();
          let score = 0;
          
          // Exact match gets highest score
          if (modelLower === queryLower) {
            score = 800;
          }
          // Starts with query gets high score
          else if (modelLower.startsWith(queryLower)) {
            score = 400;
          }
          // Contains query gets lower score
          else if (modelLower.includes(queryLower)) {
            score = 80;
          }
          
          if (score > 0) {
            modelsMap.set(row.model, Math.max(modelsMap.get(row.model) || 0, score));
          }
        }
      });

      // Sort by score (highest first) and then alphabetically
      const sortedMakes = Array.from(makesMap.entries())
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1]; // Sort by score descending
          return a[0].localeCompare(b[0]); // Then alphabetically
        })
        .map(([make]) => make)
        .slice(0, 8); // Limit to top 8 results

      const sortedModels = Array.from(modelsMap.entries())
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1]; // Sort by score descending
          return a[0].localeCompare(b[0]); // Then alphabetically
        })
        .map(([model]) => model)
        .slice(0, 8); // Limit to top 8 results

      // If there's an exact make match, also fetch popular models for that make
      const exactMakeMatch = sortedMakes.find(make => 
        make.toLowerCase() === queryLower
      );
      
      if (exactMakeMatch && sortedMakes.length === 1) {
        const { data: modelsData } = await supabase
          .from("cars")
          .select("model")
          .eq("make", exactMakeMatch)
          .eq("status", "available")
          .limit(15);

        if (modelsData) {
          const modelCounts = new Map<string, number>();
          modelsData.forEach((row: any) => {
            if (row.model?.trim()) {
              modelCounts.set(row.model, (modelCounts.get(row.model) || 0) + 1);
            }
          });
          
          // Sort by popularity (count) and then alphabetically
          const popularModels = Array.from(modelCounts.entries())
            .sort((a, b) => {
              if (b[1] !== a[1]) return b[1] - a[1];
              return a[0].localeCompare(b[0]);
            })
            .map(([model]) => model)
            .slice(0, 10);
          
          setSuggestions({ makes: sortedMakes, models: popularModels });
        } else {
          setSuggestions({ makes: sortedMakes, models: sortedModels });
        }
      } else {
        setSuggestions({ makes: sortedMakes, models: sortedModels });
      }
      
      setShowSuggestions(sortedMakes.length > 0 || sortedModels.length > 0);
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
            <View style={styles.headerContainer}>
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
              <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                <Text style={[styles.cancelText, isDarkMode && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>
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
                        <View style={styles.suggestionContent}>
                          <Text style={[styles.suggestionText, isDarkMode && styles.darkText]}>
                            {make}
                          </Text>
                          <Text style={[styles.suggestionSubtext, isDarkMode && styles.darkSubtext]}>
                            Filter by {make} vehicles
                          </Text>
                        </View>
                        <Ionicons
                          name="filter-outline"
                          size={16}
                          color={isDarkMode ? "#666" : "#999"}
                          style={styles.filterIcon}
                        />
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: 12,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 17,
    color: '#D55004',
    fontWeight: '500',
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
  suggestionContent: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionSubtext: {
    fontSize: 12,
    color: '#666',
  },
  filterIcon: {
    marginLeft: 12,
  },
  darkSubtext: {
    color: '#999',
  },
});
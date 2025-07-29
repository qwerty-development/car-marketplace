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
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { supabase } from "@/utils/supabase";
import { useTheme } from "@/utils/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/utils/AuthContext";
import { getLogoUrl } from "@/hooks/getLogoUrl";

interface Suggestions {
  makes: string[];
  models: string[];
}


export default function SearchScreen() {
    const router = useRouter();
    const { isDarkMode } = useTheme();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestions>({
      makes: [],
      models: [],
    });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const params = useLocalSearchParams<{ currentQuery?: string }>();

    // Fetch recent searches when component mounts and when user changes
    useEffect(() => {
      if (user?.id) {
        fetchRecentSearches();
      }
    }, [user?.id]);

    const fetchRecentSearches = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from("users")
          .select("recent_searches")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (data?.recent_searches) {
          setRecentSearches(Array.isArray(data.recent_searches) ? data.recent_searches : []);
        }
      } catch (err) {
        console.error("Error fetching recent searches:", err);
      }
    };

    const removeSearchQuery = async (queryToRemove: string) => {
      if (!user?.id) return;

      const updatedSearches = recentSearches.filter(query => query !== queryToRemove);

      try {
        const { error } = await supabase
          .from("users")
          .update({ recent_searches: updatedSearches })
          .eq("id", user.id);

        if (error) throw error;
        setRecentSearches(updatedSearches);
      } catch (err) {
        console.error("Error removing search query:", err);
      }
    };

    const storeSearchQuery = async (newQuery: string) => {
      if (!user?.id || !newQuery.trim()) return;

      const trimmedQuery = newQuery.trim();
      const filtered = recentSearches.filter(q => q !== trimmedQuery);
      const updated = [trimmedQuery, ...filtered].slice(0, 4);

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

    const fetchSuggestions = useCallback(async () => {
      const trimmedQuery = searchQuery.trim();
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
        console.error("Error fetching suggestions:", err);
        setSuggestions({ makes: [], models: [] });
        setShowSuggestions(false);
      }
    }, [searchQuery]);

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
          router.replace({
            pathname: "/(home)/(user)/(tabs)",
            params: {
              searchQuery: trimmedQuery,
              timestamp: Date.now() // Add timestamp to force refresh
            }
          });
        }
      };

      const handleSuggestionPress = async (suggestion: string) => {
        const trimmedQuery = suggestion.trim();
        if (trimmedQuery) {
          await storeSearchQuery(trimmedQuery);
          router.replace({
            pathname: "/(home)/(user)/(tabs)",
            params: {
              searchQuery: trimmedQuery,
              timestamp: Date.now() // Add timestamp to force refresh
            }
          });
        }
      };

    return (
      <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons
              name="close"
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
            returnKeyType="search"
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

        {!showSuggestions && recentSearches.length > 0 && (
          <View style={styles.recentSearchesContainer}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
              Recent Searches
            </Text>
            {recentSearches.map((search, index) => (
              <TouchableOpacity
                key={`recent-${index}`}
                style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
                onPress={() => handleSuggestionPress(search)}
              >
                <Ionicons
                  name="time-outline"
                  size={24}
                  color={isDarkMode ? "#666" : "#999"}
                  style={styles.recentSearchIcon}
                />
                <Text style={[styles.suggestionText, isDarkMode && styles.darkText]}>
                  {search}
                </Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeSearchQuery(search)}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={isDarkMode ? "#666" : "#999"}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            {suggestions.makes.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkText, styles.biggerSectionTitle]}>
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
                      <Text style={[styles.suggestionText, isDarkMode && styles.darkText, styles.biggerSuggestionText]}>
                        {make}
                      </Text>
                      <Text style={[styles.suggestionSubtext, isDarkMode && styles.darkSubtext]}>
                        Filter by {make} vehicles
                      </Text>
                    </View>
                    <Ionicons
                      name="filter-outline"
                      size={18}
                      color={isDarkMode ? "#666" : "#999"}
                      style={styles.filterIcon}
                    />
                  </TouchableOpacity>
                ))}
              </>
            )}

            {suggestions.models.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkText, styles.biggerSectionTitle]}>
                  Models
                </Text>
                {suggestions.models.map((model, index) => (
                  <TouchableOpacity
                    key={`model-${index}`}
                    style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
                    onPress={() => handleSuggestionPress(model)}
                  >
                    <Text style={[styles.suggestionText, isDarkMode && styles.darkText, styles.biggerSuggestionText]}>
                      {model}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}
      </SafeAreaView>
    );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop:-7,
    paddingTop:0,
    paddingBottom:8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20, // Bigger title
    fontWeight: '700', // Stronger weight
    marginLeft: 8,
    color: '#000',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    height: 52, // Slightly taller search box
    borderRadius: 26, // More rounded corners
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
  },
  darkSearchBox: {
    backgroundColor: '#222',
    borderColor: '#333',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    color: '#000',
  },
  darkSearchInput: {
    color: '#fff',
  },
  clearButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 'auto',
  },
  recentSearchesContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20, // Bigger section title
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  biggerSectionTitle: {
    fontSize: 22,
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
    paddingVertical: 14, // slightly bigger suggestion items
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  darkSuggestionItem: {
    borderBottomColor: '#222',
  },
  suggestionText: {
    fontSize: 18, // bigger text
    color: '#000',
  },
  biggerSuggestionText: {
    fontSize: 20,
  },
  brandLogo: {
    width: 32, // bigger logo
    height: 32, // bigger logo
    marginRight: 12,
  },
  darkText: {
    color: '#fff',
  },
  suggestionContent: {
    flex: 1,
    marginRight: 10,
  },
  suggestionSubtext: {
    fontSize: 14,
    color: '#666',
  },
  filterIcon: {
    marginLeft: 'auto',
  },
  darkSubtext: {
    color: '#999',
  },
});
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

interface Suggestions {
  makes: string[];
  models: string[];
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
        const { data, error } = await supabase
          .from("cars")
          .select("make, model")
          .or(`make.ilike.%${trimmedQuery}%,model.ilike.%${trimmedQuery}%`)
          .limit(20);

        if (error) throw error;

        const makesSet = new Set<string>();
        const modelsSet = new Set<string>();

        data.forEach((row: any) => {
          if (row.make?.toLowerCase().includes(trimmedQuery.toLowerCase()) && row.make.trim()) {
            makesSet.add(row.make);
          }
          if (row.model?.toLowerCase().includes(trimmedQuery.toLowerCase()) && row.model.trim()) {
            modelsSet.add(row.model);
          }
        });

        setSuggestions({
          makes: Array.from(makesSet),
          models: Array.from(modelsSet)
        });
        setShowSuggestions(makesSet.size > 0 || modelsSet.size > 0);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setSuggestions({ makes: [], models: [] });
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
            pathname: "/(home)/(dealer)/(tabs)/browse",
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
            pathname: "/(home)/(dealer)/(tabs)/browse",
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
                    <Text style={[styles.suggestionText, isDarkMode && styles.darkText, styles.biggerSuggestionText]}>
                      {make}
                    </Text>
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
    paddingVertical: 12,
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
});
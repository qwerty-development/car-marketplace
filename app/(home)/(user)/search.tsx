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
  ScrollView,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { supabase } from "@/utils/supabase";
import { useTheme } from "@/utils/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/utils/AuthContext";
import { getLogoSource } from "@/hooks/getLogoUrl";

interface Suggestions {
  makes: string[];
  models: string[];
  combos: { make: string; model: string; count: number }[];
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
      combos: [],
    });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const params = useLocalSearchParams<{ currentQuery?: string }>();

    // Fetch recent searches when component mounts and when user changes
    useEffect(() => {
      if (user?.id) {
        fetchRecentSearches();
      }
    }, [user?.id]);

    const fetchRecentSearches = useCallback(async () => {
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
    }, [user?.id]);

    const removeSearchQuery = useCallback(async (queryToRemove: string) => {
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
    }, [user?.id, recentSearches]);

    const storeSearchQuery = useCallback(async (newQuery: string) => {
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
    }, [user?.id, recentSearches]);

    const fetchSuggestions = useCallback(async () => {
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery) {
        setSuggestions({ makes: [], models: [], combos: [] });
        setShowSuggestions(false);
        return;
      }

      try {
        const queryLower = trimmedQuery.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

        // MULTI-WORD: detect "Make Model" pattern (e.g., "Audi S3", "BMW X5")
        if (queryTerms.length >= 2) {
          // Try to find make+model combos where each term matches
          // Build OR conditions for all term permutations
          const orConditions: string[] = [];
          for (let i = 0; i < queryTerms.length; i++) {
            for (let j = 0; j < queryTerms.length; j++) {
              if (i !== j) {
                orConditions.push(
                  `and(make.ilike.%${queryTerms[i]}%,model.ilike.%${queryTerms[j]}%)`
                );
              }
            }
          }

          const { data: comboData, error: comboError } = await supabase
            .from("cars")
            .select("make, model")
            .or(orConditions.join(","))
            .eq("status", "available")
            .limit(100);

          if (comboError) throw comboError;

          // Count unique make+model combos
          const comboCountMap = new Map<string, { make: string; model: string; count: number }>();
          comboData?.forEach((row: any) => {
            if (row.make?.trim() && row.model?.trim()) {
              const key = `${row.make}|||${row.model}`;
              const existing = comboCountMap.get(key);
              if (existing) {
                existing.count++;
              } else {
                comboCountMap.set(key, { make: row.make, model: row.model, count: 1 });
              }
            }
          });

          // Sort combos: exact matches first, then by count
          const combos = Array.from(comboCountMap.values())
            .sort((a, b) => {
              // Score based on how well the combo matches the query
              const scoreCombo = (combo: { make: string; model: string }) => {
                const concat = `${combo.make} ${combo.model}`.toLowerCase();
                if (concat === queryLower) return 1000;
                if (concat.startsWith(queryLower)) return 500;
                if (concat.includes(queryLower)) return 200;
                return 100;
              };
              const scoreDiff = scoreCombo(b) - scoreCombo(a);
              if (scoreDiff !== 0) return scoreDiff;
              return b.count - a.count;
            })
            .slice(0, 8);

          // Also find the matching make(s) for a "see all" option
          const matchingMakes = new Set<string>();
          comboData?.forEach((row: any) => {
            if (row.make?.trim()) matchingMakes.add(row.make);
          });
          const makes = Array.from(matchingMakes).slice(0, 3);

          setSuggestions({ makes, models: [], combos });
          setShowSuggestions(combos.length > 0 || makes.length > 0);
          return;
        }

        // SINGLE-WORD QUERY: original behavior with make/model suggestions
        const { data, error } = await supabase
          .from("cars")
          .select("make, model")
          .or(`make.ilike.%${trimmedQuery}%,model.ilike.%${trimmedQuery}%`)
          .eq("status", "available")
          .limit(50);

        if (error) throw error;

        const makesMap = new Map<string, number>();
        const modelsMap = new Map<string, number>();

        // Score and collect unique makes and models
        data.forEach((row: any) => {
          if (row.make?.trim()) {
            const makeLower = row.make.toLowerCase();
            let score = 0;
            if (makeLower === queryLower) score = 1000;
            else if (makeLower.startsWith(queryLower)) score = 500;
            else if (makeLower.includes(queryLower)) score = 100;
            
            if (score > 0) {
              makesMap.set(row.make, Math.max(makesMap.get(row.make) || 0, score));
            }
          }
          
          if (row.model?.trim()) {
            const modelLower = row.model.toLowerCase();
            let score = 0;
            if (modelLower === queryLower) score = 800;
            else if (modelLower.startsWith(queryLower)) score = 400;
            else if (modelLower.includes(queryLower)) score = 80;
            
            if (score > 0) {
              modelsMap.set(row.model, Math.max(modelsMap.get(row.model) || 0, score));
            }
          }
        });

        const sortedMakes = Array.from(makesMap.entries())
          .sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0]))
          .map(([make]) => make)
          .slice(0, 8);

        const sortedModels = Array.from(modelsMap.entries())
          .sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0]))
          .map(([model]) => model)
          .slice(0, 8);

        // If there's an exact make match and it's the only make, fetch its popular models as combos
        const exactMakeMatch = sortedMakes.find(make => 
          make.toLowerCase() === queryLower
        );
        
        if (exactMakeMatch && sortedMakes.length === 1) {
          const { data: modelsData } = await supabase
            .from("cars")
            .select("model")
            .eq("make", exactMakeMatch)
            .eq("status", "available")
            .limit(30);

          if (modelsData) {
            const modelCounts = new Map<string, number>();
            modelsData.forEach((row: any) => {
              if (row.model?.trim()) {
                modelCounts.set(row.model, (modelCounts.get(row.model) || 0) + 1);
              }
            });
            
            // Show as combos (Make + Model) for clarity
            const combos = Array.from(modelCounts.entries())
              .sort((a, b) => b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0]))
              .map(([model, count]) => ({ make: exactMakeMatch, model, count }))
              .slice(0, 10);
            
            setSuggestions({ makes: sortedMakes, models: [], combos });
          } else {
            setSuggestions({ makes: sortedMakes, models: sortedModels, combos: [] });
          }
        } else {
          setSuggestions({ makes: sortedMakes, models: sortedModels, combos: [] });
        }
        
        setShowSuggestions(sortedMakes.length > 0 || sortedModels.length > 0);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setSuggestions({ makes: [], models: [], combos: [] });
        setShowSuggestions(false);
      }
    }, [searchQuery]);

    useEffect(() => {
      const delayDebounce = setTimeout(() => {
        fetchSuggestions();
      }, 300);
      return () => clearTimeout(delayDebounce);
    }, [searchQuery, fetchSuggestions]);

    const handleSearchSubmit = useCallback(async () => {
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
      }, [searchQuery, storeSearchQuery, router]);

      const handleSuggestionPress = useCallback(async (suggestion: string) => {
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
      }, [storeSearchQuery, router]);

    return (
      <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]}>
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
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={[styles.cancelText, isDarkMode && styles.darkText]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={{ flex: 1 }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!showSuggestions && recentSearches.length > 0 && (
            <View style={styles.recentSearchesContainer}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
                Recent Searches
              </Text>
              {recentSearches.map((search) => (
                <TouchableOpacity
                  key={`recent-${search}`}
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
            {/* Combined Make + Model suggestions (shown for multi-word or exact-make queries) */}
            {suggestions.combos.length > 0 && (
              <>
                {suggestions.makes.length > 0 && suggestions.combos.length > 0 && (
                  <>
                    {suggestions.makes.map((make) => (
                      <TouchableOpacity
                        key={`make-all-${make}`}
                        style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
                        onPress={() => handleSuggestionPress(make)}
                      >
                        <Image
                          source={getLogoSource(make, isDarkMode) ?? require('@/assets/images/placeholder-logo.png')}
                          style={styles.brandLogo}
                          resizeMode="contain"
                        />
                        <View style={styles.suggestionContent}>
                          <Text style={[styles.suggestionText, isDarkMode && styles.darkText, styles.biggerSuggestionText]}>
                            {make}
                          </Text>
                          <Text style={[styles.suggestionSubtext, isDarkMode && styles.darkSubtext]}>
                            All {make} vehicles
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={isDarkMode ? "#666" : "#999"}
                        />
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {suggestions.combos.map((combo) => (
                  <TouchableOpacity
                    key={`combo-${combo.make}-${combo.model}`}
                    style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
                    onPress={() => handleSuggestionPress(`${combo.make} ${combo.model}`)}
                  >
                    <Image
                      source={getLogoSource(combo.make, isDarkMode) ?? require('@/assets/images/placeholder-logo.png')}
                      style={styles.brandLogo}
                      resizeMode="contain"
                    />
                    <View style={styles.suggestionContent}>
                      <Text style={[styles.suggestionText, isDarkMode && styles.darkText, styles.biggerSuggestionText]}>
                        {combo.make} {combo.model}
                      </Text>
                      {combo.count > 1 && (
                        <Text style={[styles.suggestionSubtext, isDarkMode && styles.darkSubtext]}>
                          {combo.count} available
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name="search"
                      size={18}
                      color={isDarkMode ? "#666" : "#999"}
                    />
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Make-only suggestions (shown for single-word queries without combos) */}
            {suggestions.combos.length === 0 && suggestions.makes.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkText, styles.biggerSectionTitle]}>
                  Makes
                </Text>
                {suggestions.makes.map((make) => (
                  <TouchableOpacity
                    key={`make-${make}`}
                    style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
                    onPress={() => handleSuggestionPress(make)}
                  >
                    <Image
                      source={getLogoSource(make, isDarkMode) ?? require('@/assets/images/placeholder-logo.png')}
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

            {/* Model-only suggestions (shown only when no combos) */}
            {suggestions.combos.length === 0 && suggestions.models.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkText, styles.biggerSectionTitle]}>
                  Models
                </Text>
                {suggestions.models.map((model) => (
                  <TouchableOpacity
                    key={`model-${model}`}
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
      </ScrollView>
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
  darkSearchBox: {
    backgroundColor: '#222',
    borderColor: '#333',
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
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 17,
    color: '#D55004',
    fontWeight: '500',
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
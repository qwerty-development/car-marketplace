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
import { useLanguage } from "@/utils/LanguageContext";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/utils/AuthContext";
import { getLogoSource } from "@/hooks/getLogoUrl";

interface Suggestions {
  makes: string[];
  models: string[];
}


export default function SearchScreen() {
    const router = useRouter();
    const { isDarkMode } = useTheme();
    const { language } = useLanguage();
    const { t } = useTranslation();
    const { user } = useAuth();
    const isRTL = language === 'ar';
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
        <View style={[styles.headerContainer, isRTL && styles.rtlHeaderContainer]}>
          <View style={[
            styles.searchBox,
            isDarkMode && styles.darkSearchBox,
            isRTL && styles.rtlSearchBox
          ]}>
            <FontAwesome
              name="search"
              size={20}
              color={isDarkMode ? "#ccc" : "#666"}
              style={[styles.searchIcon, isRTL && styles.rtlSearchIcon]}
            />
            <TextInput
              style={[
                styles.searchInput,
                isDarkMode && styles.darkSearchInput,
                isRTL && styles.rtlTextInput
              ]}
              placeholder={t('common.search')}
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
                style={[styles.clearButton, isRTL && styles.rtlClearButton]}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={isDarkMode ? "#666" : "#999"}
                />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.cancelButton, isRTL && styles.rtlCancelButton]}
          >
            <Text style={[styles.cancelText, isDarkMode && styles.darkText]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>

        {!showSuggestions && recentSearches.length > 0 && (
          <View style={styles.recentSearchesContainer}>
            <Text style={[
              styles.sectionTitle,
              isDarkMode && styles.darkText,
              isRTL && styles.rtlText
            ]}>
              {t('recentSearches')}
            </Text>
            {recentSearches.map((search, index) => (
              <TouchableOpacity
                key={`recent-${index}`}
                style={[
                  styles.suggestionItem,
                  isDarkMode && styles.darkSuggestionItem,
                  isRTL && styles.rtlSuggestionItem
                ]}
                onPress={() => handleSuggestionPress(search)}
              >
                <Ionicons
                  name="time-outline"
                  size={24}
                  color={isDarkMode ? "#666" : "#999"}
                  style={[styles.recentSearchIcon, isRTL && styles.rtlRecentIcon]}
                />
                <Text style={[
                  styles.suggestionText,
                  isDarkMode && styles.darkText,
                  isRTL && styles.rtlText
                ]}>
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
                      source={getLogoSource(make, isDarkMode) ?? require('@/assets/images/placeholder-logo.png')}
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rtlHeaderContainer: {
    flexDirection: 'row-reverse',
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
  rtlSearchBox: {
    flexDirection: 'row-reverse',
    marginRight: 0,
    marginLeft: 12,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  rtlCancelButton: {},
  cancelText: {
    fontSize: 17,
    color: '#D55004',
    fontWeight: '500',
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
  // RTL Support Styles
  rtlSearchBox: {
    flexDirection: 'row-reverse',
  },
  rtlSearchIcon: {
    marginRight: 0,
    marginLeft: 8,
  },
  rtlTextInput: {
    textAlign: 'right',
  },
  rtlClearButton: {
    marginLeft: 0,
    marginRight: 8,
  },
  rtlText: {
    textAlign: 'right',
  },
  rtlSuggestionItem: {
    flexDirection: 'row-reverse',
  },
  rtlRecentIcon: {
    marginRight: 0,
    marginLeft: 12,
  },
});
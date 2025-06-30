import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { supabase } from '@/utils/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ModelDropdownProps {
  make: string;
  value: string | null;
  onChange: (model: string) => void;
  error?: string;
  isDarkMode: boolean;
  placeholder?: string;
  disabled?: boolean;
}

interface ModelItem {
  model: string;
  id: string;
}

/**
 * ENHANCED MODEL DROPDOWN COMPONENT
 * 
 * FEATURES:
 * - Robust modal management with proper touch handling
 * - Search functionality with real-time filtering
 * - Performance optimized with FlatList and memoization
 * - Smooth animations and transitions
 * - Comprehensive error handling and loading states
 * - Accessibility support
 * - Keyboard-aware layout
 */
export const ModelDropdown: React.FC<ModelDropdownProps> = React.memo(({
  make,
  value,
  onChange,
  error,
  isDarkMode,
  placeholder = "Select Model",
  disabled = false,
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [filteredModels, setFilteredModels] = useState<ModelItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ============================================================================
  // ANIMATION VALUES
  // ============================================================================
  
  const modalScale = useSharedValue(0);
  const modalOpacity = useSharedValue(0);
  const slideY = useSharedValue(SCREEN_HEIGHT * 0.6); // MODIFIED: Reduced initial offset

  // ============================================================================
  // REFS
  // ============================================================================
  
  const searchInputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  // ============================================================================
  // MEMOIZED VALUES
  // ============================================================================
  
  const displayValue = useMemo(() => {
    return value || placeholder;
  }, [value, placeholder]);

  const isValueSelected = useMemo(() => {
    return Boolean(value);
  }, [value]);

  // ============================================================================
  // DATA FETCHING LOGIC
  // ============================================================================
  
  const fetchModels = useCallback(async () => {
    if (!make) {
      setModels([]);
      setFilteredModels([]);
      return;
    }

    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    try {
      console.log(`[ModelDropdown] Fetching models for make: ${make}`);
      
      const { data, error: supabaseError } = await supabase
        .from('allcars')
        .select('model')
        .eq('make', make)
        .order('model', { ascending: true });

      if (supabaseError) {
        throw new Error(`Database error: ${supabaseError.message}`);
      }

      if (!data || data.length === 0) {
        console.warn(`[ModelDropdown] No models found for make: ${make}`);
        setModels([]);
        setFilteredModels([]);
        setErrorMessage(`No models available for ${make}`);
        return;
      }

      // PROCESS AND DEDUPLICATE MODELS
      const uniqueModels = Array.from(
        new Set(
          data
            .map(item => item.model)
            .filter((model): model is string => Boolean(model?.trim()))
        )
      );

      const modelItems: ModelItem[] = uniqueModels.map((model, index) => ({
        model: model.trim(),
        id: `${make}-${model}-${index}`,
      }));

      console.log(`[ModelDropdown] Successfully loaded ${modelItems.length} models`);
      
      setModels(modelItems);
      setFilteredModels(modelItems);

    } catch (error) {
      console.error('[ModelDropdown] Error fetching models:', error);
      
      const errorMsg = error instanceof Error 
        ? error.message 
        : 'Failed to load models';
        
      setHasError(true);
      setErrorMessage(errorMsg);
      setModels([]);
      setFilteredModels([]);

      // SHOW USER-FRIENDLY ERROR ALERT
      Alert.alert(
        'Loading Error', 
        `Unable to load models for ${make}. Please try again.`,
        [{ text: 'OK', style: 'default' }]
      );

    } finally {
      setIsLoading(false);
    }
  }, [make]);

  // ============================================================================
  // SEARCH FUNCTIONALITY
  // ============================================================================
  
  const filterModels = useCallback((query: string) => {
    if (!query.trim()) {
      setFilteredModels(models);
      return;
    }

    const filtered = models.filter(item =>
      item.model.toLowerCase().includes(query.toLowerCase().trim())
    );

    setFilteredModels(filtered);
    
    // SCROLL TO TOP WHEN FILTERING
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [models]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    filterModels(query);
  }, [filterModels]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setFilteredModels(models);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [models]);

  // ============================================================================
  // MODAL ANIMATION FUNCTIONS
  // ============================================================================
  
  const showModal = useCallback(() => {
    setIsModalVisible(true);
    
    // ANIMATE MODAL ENTRANCE
    modalOpacity.value = withTiming(1, { duration: 200 });
    modalScale.value = withSpring(1, { 
      damping: 15, 
      stiffness: 100 
    });
    slideY.value = withSpring(0, { 
      damping: 20, 
      stiffness: 90 
    });

    // FOCUS SEARCH INPUT AFTER ANIMATION
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
  }, [modalOpacity, modalScale, slideY]);

  const hideModal = useCallback(() => {
    // ANIMATE MODAL EXIT
    modalOpacity.value = withTiming(0, { duration: 200 });
    modalScale.value = withTiming(0.8, { duration: 200 });
    slideY.value = withTiming(SCREEN_HEIGHT * 0.6, { duration: 250 }); // MODIFIED: Consistent exit offset

    // HIDE MODAL AFTER ANIMATION
    setTimeout(() => {
      runOnJS(() => {
        setIsModalVisible(false);
        setSearchQuery('');
        setFilteredModels(models);
        Keyboard.dismiss();
      })();
    }, 250);
  }, [modalOpacity, modalScale, slideY, models]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  const handleDropdownPress = useCallback(() => {
    if (disabled || isLoading) return;

    if (!make) {
      Alert.alert(
        'Select Brand First', 
        'Please select a vehicle brand before choosing a model.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    showModal();
  }, [disabled, isLoading, make, showModal]);

  const handleModelSelect = useCallback((selectedModel: string) => {
    console.log(`[ModelDropdown] Model selected: ${selectedModel}`);
    
    onChange(selectedModel);
    hideModal();
  }, [onChange, hideModal]);

  const handleBackdropPress = useCallback(() => {
    hideModal();
  }, [hideModal]);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    // RESET SEARCH WHEN MODAL OPENS
    if (isModalVisible) {
      setSearchQuery('');
      setFilteredModels(models);
    }
  }, [isModalVisible, models]);

  // ============================================================================
  // ANIMATION STYLES
  // ============================================================================
  
  const modalBackdropStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
  }));

  const modalContentStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: modalScale.value },
      { translateY: slideY.value }
    ],
  }));

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================
  
  const renderModelItem = useCallback(({ item }: { item: ModelItem }) => (
    <TouchableOpacity
      onPress={() => handleModelSelect(item.model)}
      activeOpacity={0.7}
      className={`
        px-4 py-4 mx-2 mb-2 rounded-xl
        ${value === item.model 
          ? 'bg-red' 
          : isDarkMode 
            ? 'bg-neutral-800' 
            : 'bg-neutral-100'
        }
      `}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className={`
            text-base flex-1
            ${value === item.model
              ? 'text-white font-semibold'
              : isDarkMode
                ? 'text-white'
                : 'text-black'
            }
          `}
          numberOfLines={1}
        >
          {item.model}
        </Text>
        {value === item.model && (
          <MaterialCommunityIcons
            name="check-circle"
            size={20}
            color="white"
            style={{ marginLeft: 8 }}
          />
        )}
      </View>
    </TouchableOpacity>
  ), [value, isDarkMode, handleModelSelect]);

  const renderEmptyState = useCallback(() => (
    <View className="flex-1 justify-center items-center py-12">
      <MaterialCommunityIcons
        name="car-off"
        size={48}
        color={isDarkMode ? '#6B7280' : '#9CA3AF'}
      />
      <Text
        className={`
          text-center mt-4 text-base
          ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}
        `}
      >
        {searchQuery 
          ? `No models found for "${searchQuery}"`
          : hasError 
            ? errorMessage || 'Error loading models'
            : 'No models available'
        }
      </Text>
      {searchQuery && (
        <TouchableOpacity
          onPress={clearSearch}
          className="mt-4 px-4 py-2 bg-red rounded-full"
        >
          <Text className="text-white font-medium">Clear Search</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [isDarkMode, searchQuery, hasError, errorMessage, clearSearch]);

  const renderLoadingState = useCallback(() => (
    <View className="flex-1 justify-center items-center py-12">
      <ActivityIndicator size="large" color="#D55004" />
      <Text
        className={`
          text-center mt-4 text-base
          ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}
        `}
      >
        Loading {make} models...
      </Text>
    </View>
  ), [isDarkMode, make]);

  // ============================================================================
  // MAIN COMPONENT RENDER
  // ============================================================================
  
  return (
    <View className="mb-6">
      {/* FIELD LABEL */}
      <Text
        className={`
          text-sm font-medium mb-2 
          ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}
        `}
      >
        Model
        {error && <Text className="text-red"> *</Text>}
      </Text>

      {/* DROPDOWN TRIGGER */}
      <TouchableOpacity
        onPress={handleDropdownPress}
        disabled={disabled || isLoading}
        activeOpacity={0.8}
        className={`
          rounded-2xl overflow-hidden
          ${error ? 'border border-red' : ''}
          ${disabled ? 'opacity-50' : ''}
        `}
      >
        <BlurView
          intensity={isDarkMode ? 20 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          className="p-4"
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center flex-1">
              <MaterialCommunityIcons
                name="car-info"
                size={20}
                color={
                  disabled 
                    ? (isDarkMode ? '#6B7280' : '#9CA3AF')
                    : isValueSelected
                      ? '#D55004'
                      : (isDarkMode ? '#fff' : '#000')
                }
              />
              <Text
                className={`
                  ml-3 text-base flex-1
                  ${isValueSelected
                    ? (isDarkMode ? 'text-white' : 'text-black')
                    : (isDarkMode ? 'text-neutral-400' : 'text-neutral-500')
                  }
                `}
                numberOfLines={1}
              >
                {displayValue}
              </Text>
            </View>
            
            {isLoading ? (
              <ActivityIndicator size="small" color="#D55004" />
            ) : (
              <Ionicons
                name="chevron-down"
                size={20}
                color={
                  disabled 
                    ? (isDarkMode ? '#6B7280' : '#9CA3AF')
                    : (isDarkMode ? '#fff' : '#000')
                }
              />
            )}
          </View>
        </BlurView>
      </TouchableOpacity>

      {/* ERROR MESSAGE */}
      {error && (
        <Text className="text-red text-sm mt-1 ml-1">
          {error}
        </Text>
      )}

      {/* MODAL */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={hideModal}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <Animated.View 
            style={[{ flex: 1 }, modalBackdropStyle]}
            className="bg-black/50"
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View 
                style={[modalContentStyle]}
                className="flex-1 justify-center pt-20" // MODIFIED: Changed from justify-end to justify-center with top padding
              >
                <BlurView
                  intensity={isDarkMode ? 30 : 20}
                  tint={isDarkMode ? 'dark' : 'light'}
                  className={`
                    rounded-3xl overflow-hidden mx-4
                    ${isDarkMode ? 'bg-black/90' : 'bg-white/90'}
                  `}
                  style={{ 
                    maxHeight: SCREEN_HEIGHT * 0.85, // MODIFIED: Increased from 0.8 to 0.85
                    minHeight: SCREEN_HEIGHT * 0.55, // MODIFIED: Increased from 0.4 to 0.55
                  }}
                >
                  {/* MODAL HEADER */}
                  <View className="p-4 border-b border-neutral-200/10">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`
                          text-xl font-bold
                          ${isDarkMode ? 'text-white' : 'text-black'}
                        `}
                      >
                        Select {make} Model
                      </Text>
                      <TouchableOpacity
                        onPress={hideModal}
                        className="p-2 -mr-2"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name="close"
                          size={24}
                          color={isDarkMode ? '#fff' : '#000'}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* SEARCH BAR */}
                    <View className="mt-4">
                      <View
                        className={`
                          flex-row items-center rounded-xl px-3 py-2
                          ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'}
                        `}
                      >
                        <Ionicons
                          name="search"
                          size={20}
                          color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                        />
                        <TextInput
                          ref={searchInputRef}
                          value={searchQuery}
                          onChangeText={handleSearchChange}
                          placeholder="Search models..."
                          placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
                          className={`
                            flex-1 ml-3 text-base
                            ${isDarkMode ? 'text-white' : 'text-black'}
                          `}
                          autoCorrect={false}
                          autoCapitalize="words"
                          returnKeyType="search"
                        />
                        {searchQuery ? (
                          <TouchableOpacity
                            onPress={clearSearch}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons
                              name="close-circle"
                              size={20}
                              color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                            />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>

                    {/* RESULTS COUNTER */}
                    {!isLoading && filteredModels.length > 0 && (
                      <Text
                        className={`
                          text-sm mt-2
                          ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}
                        `}
                      >
                        {filteredModels.length} model{filteredModels.length !== 1 ? 's' : ''} found
                      </Text>
                    )}
                  </View>

                  {/* MODEL LIST */}
                  <View className="flex-1 pt-2">
                    {isLoading ? (
                      renderLoadingState()
                    ) : filteredModels.length === 0 ? (
                      renderEmptyState()
                    ) : (
                      <FlatList
                        ref={flatListRef}
                        data={filteredModels}
                        renderItem={renderModelItem}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ 
                          paddingBottom: Platform.OS === 'ios' ? 20 : 10 
                        }}
                        initialNumToRender={10}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        removeClippedSubviews={true}
                        getItemLayout={(data, index) => ({
                          length: 60, // Approximate item height
                          offset: 60 * index,
                          index,
                        })}
                      />
                    )}
                  </View>
                </BlurView>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
});
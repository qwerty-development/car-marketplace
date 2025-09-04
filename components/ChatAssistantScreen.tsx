import React, { useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  Animated,
  FlatList,
  AppState,
  AppStateStatus,
  LayoutAnimation,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { ChatbotService } from '@/services/ChatbotService';
import { useCarDetails } from '@/hooks/useCarDetails';
import { useRouter } from 'expo-router';
import CompactCarCard from '@/components/CompactCarCard';
import * as Haptics from 'expo-haptics';

interface Message {
  from: 'user' | 'bot';
  text: string;
  timestamp: Date;
  cars?: any[];
}

interface ChatAssistantScreenProps {
  /**
   * Called when the chat should be closed (e.g. when navigating away)
   */
  onClose?: () => void;
}

export default function EnhancedChatScreen({ onClose }: ChatAssistantScreenProps) {
  const { isDarkMode } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      from: 'bot',
      text: "Hi there! 👋 I'm your AI car assistant. I'll help you find the perfect vehicle based on your needs, budget, and preferences. What can I help you with today?",
      timestamp: new Date(),
    }
  ]);
  const [carDataMap, setCarDataMap] = useState<{ [id:number]: any }>({});
  const { prefetchCarDetails } = useCarDetails();
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  const inputAnimation = useRef(new Animated.Value(0)).current;
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Hydrate service history once (background continuity)
  useEffect(() => {
    ChatbotService.hydrateFromStorage?.();
  }, []);

  // --------------------------------------------------
  // Clear chat on app termination/restart
  // --------------------------------------------------
  useEffect(() => {
    const checkAppTermination = async () => {
      try {
        // Use a timestamp to detect if the app was actually terminated
        const lastActiveTime = await AsyncStorage.getItem('last_active_time');
        const currentTime = Date.now();
        
        if (lastActiveTime) {
          const timeDiff = currentTime - parseInt(lastActiveTime);
          // If more than 30 minutes passed, consider it a fresh app start
          const thirtyMinutes = 30 * 60 * 1000;
          
          if (timeDiff > thirtyMinutes) {
            // App was likely terminated, clear chat
            ChatbotService.clearConversationHistory();
          }
        } else {
          // First time launch, clear any existing chat
          ChatbotService.clearConversationHistory();
        }
        
        // Update last active time
        await AsyncStorage.setItem('last_active_time', currentTime.toString());
      } catch (e) {
        console.log('Error checking app termination:', e);
      }
    };

    checkAppTermination();
  }, []);

  // --------------------------------------------------
  // Update last active time when app becomes active
  // --------------------------------------------------
  useEffect(() => {
    const updateActiveTime = () => {
      AsyncStorage.setItem('last_active_time', Date.now().toString()).catch(() => {});
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        updateActiveTime();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  // --------------------------------------------------
  // Persist / Restore Messages
  // --------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('ai_chat_messages');
        if (saved) {
          const parsed: Message[] = JSON.parse(saved);
          // Restore Date objects for timestamps
          const restored = parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
          if (isMountedRef.current) {
            setMessages(restored);
          }
        }
      } catch (e) {
        console.log('Failed to load chat history', e);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('ai_chat_messages', JSON.stringify(messages)).catch(() => {});
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
  }, [messages]);

  const animateInput = (focused: boolean) => {
    setInputFocused(focused);
    Animated.spring(inputAnimation, {
      toValue: focused ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const scrollToBottom = useCallback(() => {
    if (scrollViewRef.current && isMountedRef.current) {
      try {
        setTimeout(() => {
          if (scrollViewRef.current && isMountedRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        }, Platform.OS === 'ios' ? 150 : 100);
      } catch (error) {
        console.log('Scroll error (non-critical):', error);
      }
    }
  }, []);

  const sendMessage = async () => {
    const trimmed = inputText.trim();
    // Allow processing even if component might unmount immediately after (background)
    if (!trimmed || isLoading) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.log('Haptics not supported or failed:', e);
    }

    try {
      if (isMountedRef.current) {
        setMessages(prev => [...prev, { 
          from: 'user', 
          text: trimmed, 
          timestamp: new Date() 
        }]);
        setInputText('');
        setIsLoading(true);
      }

      const result = Platform.OS === 'ios'
        ? await ChatbotService.sendMessageWithContext(trimmed)
        : await ChatbotService.sendMessageWithContext(trimmed);

      // Allow background completion even if unmounted; only set state if still mounted
      if (!isMountedRef.current) {
        // Still send request, but skip UI updates
      }

      const botText = result.botMessage?.message || 'Error: Unable to get response.';
      
      const cars = result.botMessage?.car_ids ? 
        await fetchCarDetails(result.botMessage.car_ids) : [];

      if (isMountedRef.current) {
        setMessages(prev => [...prev, { 
          from: 'bot', 
          text: botText,
          timestamp: new Date(),
          cars: cars.length > 0 ? cars : undefined
        }]);
      }
      
    } catch (err) {
      console.error('Chat error:', err);
      
      if (isMountedRef.current) {
        setMessages(prev => [...prev, { 
          from: 'bot', 
          text: 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.',
          timestamp: new Date()
        }]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        scrollToBottom();
      }
    }
  };

  const fetchCarDetails = async (carIds: number[]) => {
    const limited = carIds.slice(0, 8);
    const cars: any[] = [];
    const newMap: { [id:number]: any } = {};

    for (const id of limited) {
      if (carDataMap[id]) {
        cars.push(carDataMap[id]);
        continue;
      }

      try {
        const data = await prefetchCarDetails(id.toString());
        if (data) {
          cars.push(data);
          newMap[id] = data;
        }
      } catch (e) {
        console.log('Failed to fetch car', id, e);
      }
    }

    if (Object.keys(newMap).length) {
      setCarDataMap(prev => ({ ...prev, ...newMap }));
    }

    return cars;
  };

  const formatCarText = (text: string) => {
    // Enhanced text formatting for car listings with professional styling
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Check if line is a car listing (contains year and make/model pattern)
      const carPattern = /(\d{4})\s+([A-Za-z]+)\s+([A-Za-z0-9\s]+)/;
      const pricePattern = /\$[\d,]+/g;
      const mileagePattern = /[\d,]+\s*(miles?|mi)/gi;
      const featurePattern = /•\s*(.+)/;
      
      if (carPattern.test(line)) {
        // Main car listing line
        const match = line.match(carPattern);
        if (match) {
          const [, year, make, model] = match;
          const restOfLine = line.replace(carPattern, '').trim();
          return (
            <View key={index} className="flex-row items-center mb-2 pl-1">
              <View className="w-1 h-6 bg-orange-500 rounded-full mr-3" />
              <View className="flex-1">
                <View className="flex-row items-baseline flex-wrap">
                  <Text className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                    {year} {make} {model}
                  </Text>
                  {restOfLine && (
                    <Text className={`ml-2 text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {restOfLine.replace(pricePattern, '').replace(mileagePattern, '').trim()}
                    </Text>
                  )}
                </View>
                <View className="flex-row items-center mt-1 flex-wrap">
                  {line.match(pricePattern) && (
                    <View className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-md mr-2 mb-1">
                      <Text className="text-green-700 dark:text-green-400 font-semibold text-xs">
                        {line.match(pricePattern)?.[0]}
                      </Text>
                    </View>
                  )}
                  {line.match(mileagePattern) && (
                    <View className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md mr-2 mb-1">
                      <Text className="text-blue-700 dark:text-blue-400 font-medium text-xs">
                        {line.match(mileagePattern)?.[0]}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        }
      } else if (featurePattern.test(line)) {
        // Feature bullet points
        const feature = line.replace('•', '').trim();
        return (
          <View key={index} className="flex-row items-start ml-6 mb-1">
            <View className="w-1 h-1 bg-neutral-400 rounded-full mt-2 mr-2" />
            <Text className={`text-sm flex-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
              {feature}
            </Text>
          </View>
        );
      } else if (line.trim() === '') {
        // Empty line spacing
        return <View key={index} className="h-2" />;
      } else {
        // Regular text with enhanced formatting for prices and numbers
        let formattedLine = line;
        const segments = [];
        let lastIndex = 0;
        
        // Highlight prices
        const priceMatches = [...line.matchAll(pricePattern)];
        priceMatches.forEach((match) => {
          if (match.index !== undefined) {
            // Add text before price
            if (match.index > lastIndex) {
              segments.push({
                type: 'text',
                content: line.slice(lastIndex, match.index)
              });
            }
            // Add price
            segments.push({
              type: 'price',
              content: match[0]
            });
            lastIndex = match.index + match[0].length;
          }
        });
        
        // Add remaining text
        if (lastIndex < line.length) {
          segments.push({
            type: 'text',
            content: line.slice(lastIndex)
          });
        }
        
        if (segments.length > 0) {
          return (
            <View key={index} className="mb-1">
              <Text className={`text-sm leading-5 ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                {segments.map((segment, segIndex) => (
                  <Text key={segIndex} className={
                    segment.type === 'price' 
                      ? 'font-bold text-green-600 dark:text-green-400' 
                      : ''
                  }>
                    {segment.content}
                  </Text>
                ))}
              </Text>
            </View>
          );
        } else {
          return (
            <Text key={index} className={`text-sm leading-5 mb-1 ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
              {line}
            </Text>
          );
        }
      }
    });
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.from === 'user';
    const bubbleBase = isUser
      ? 'bg-neutral-200 dark:bg-neutral-700/70 rounded-2xl px-4 py-3 shadow-sm'
      : 'bg-white dark:bg-neutral-900/60 border border-neutral-200/40 dark:border-neutral-700/40 rounded-2xl px-4 py-3 shadow-sm';

    return (
      <Animated.View
        key={index}
        className={`flex-row mb-4 items-end ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        {!isUser && (
          <View className="mr-3 mb-1">
            <View className="w-8 h-8 bg-red rounded-full items-center justify-center shadow-sm">
              <MaterialCommunityIcons name="robot-outline" size={16} color="white" />
            </View>
          </View>
        )}
        
        <View className={`max-w-[78%] ${isUser ? 'ml-12' : 'mr-12'}`}>
          <View
            accessibilityLabel={isUser ? 'User message' : 'Assistant message'}
            className={`${bubbleBase} relative`}
          >
            {!isUser && (
              <View className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl bg-gradient-to-b from-red-500 to-orange-500" />
            )}
            <View>
              {formatCarText(message.text)}
            </View>
            
            {message.cars && message.cars.length > 0 && (
              <View className="mt-4 pt-3 border-t border-neutral-200/30 dark:border-neutral-600/30">
                <View className="flex-row items-center mb-3">
                  <View className="w-6 h-6 bg-red rounded-full items-center justify-center mr-2">
                    <Ionicons name="car-sport" size={12} color="white" />
                  </View>
                  <Text className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                    {message.cars.length} vehicle{message.cars.length === 1 ? '' : 's'} found
                  </Text>
                </View>
                
                <FlatList
                  data={message.cars}
                  renderItem={({ item }) => (
                    <CompactCarCard 
                      car={item} 
                      isDarkMode={isDarkMode}
                      onPress={() => {
                        if (onClose) {
                          onClose();
                        }
                        router.push({
                          pathname: '/(home)/(user)/CarDetails',
                          params: { carId: item.id.toString(), isDealerView: 'false' },
                        });
                      }}
                    />
                  )}
                  keyExtractor={(item) => item.id.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 16 }}
                  snapToInterval={280}
                  decelerationRate="fast"
                />
              </View>
            )}
            
            <Text className={`text-[10px] mt-3 tracking-wide ${
              isUser
                ? isDarkMode
                  ? 'text-neutral-300'
                  : 'text-neutral-600'
                : isDarkMode
                ? 'text-neutral-400'
                : 'text-neutral-500'
            }`}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const suggestedQuestions = [
    "SUVs under $30k",
    "Luxury sedans",
    "Hybrid vehicles", 
    "Manual transmission",
    "Low mileage cars"
  ];

  const handleSuggestedQuestion = async (question: string) => {
    setInputText(question);
    setTimeout(() => sendMessage(), 100);
  };

  const clearChat = () => {
    // Reset to the original greeting message only
    const greetingMessage: Message = {
      from: 'bot',
      text: "Hi there! 👋 I'm your AI car assistant. I'll help you find the perfect vehicle based on your needs, budget, and preferences. What can I help you with today?",
      timestamp: new Date(),
    };
    setMessages([greetingMessage]);
    setCarDataMap({});
    // Clear the ChatbotService conversation history (which also clears AsyncStorage)
    ChatbotService.clearConversationHistory();
  };

  return (
    <SafeAreaView className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-neutral-50'}`}>
      {/* Header */}
      <View className={`px-4 py-4 border-b ${isDarkMode ? 'border-neutral-800 bg-black' : 'border-neutral-200 bg-neutral-50'}`}>
        <View className="flex-row items-center pr-14">{/* pr-14 reserves space for external close X */}
          <View className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-full items-center justify-center mr-3 shadow-lg">
            <MaterialCommunityIcons name="robot-outline" size={20} color="white" />
          </View>
          <View className="flex-1 mr-3">
            <Text className={`text-lg font-bold ${isDarkMode ? 'text-orange-400' : 'text-red-600'}`}>
              Car Finder AI
            </Text>
            <Text className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Your intelligent car assistant
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Clear chat"
            onPress={clearChat}
            className="w-9 h-9 rounded-full items-center justify-center bg-neutral-200/60 dark:bg-neutral-800"
            activeOpacity={0.7}
            style={{ marginRight: 4 }}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={isDarkMode ? '#f87171' : '#b91c1c'} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setShowScrollToBottom(y > 120);
          }}
          scrollEventThrottle={16}
        >
          {messages.map(renderMessage)}
          
          {isLoading && (
            <View className="flex-row mb-4 items-end justify-start">
              <View className="mr-3 mb-1">
                <View className="w-8 h-8 bg-red-500 rounded-full items-center justify-center shadow-sm">
                  <ActivityIndicator color="white" size="small" />
                </View>
              </View>
              <View
                className={`max-w-[78%] mr-12 rounded-2xl px-4 py-4 min-h-[60px] justify-center ${isDarkMode ? 'bg-neutral-800/95 border-neutral-700/50' : 'bg-white border-neutral-100/80'} shadow-sm rounded-bl-md border`}
              >
                <View className="items-center">
                  <View className="flex-row mb-2">
                    <View className="w-2 h-2 bg-orange-500 rounded-full mx-1 animate-pulse" />
                    <View className="w-2 h-2 bg-orange-500 rounded-full mx-1 animate-pulse" style={{animationDelay: '0.2s'}} />
                    <View className="w-2 h-2 bg-orange-500 rounded-full mx-1 animate-pulse" style={{animationDelay: '0.4s'}} />
                  </View>
                  <Text className={`text-sm font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    Finding perfect matches...
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Only show suggestions when not focused and few messages - prevents keyboard overlap */}
        {messages.length <= 1 && !isLoading && !inputFocused && (
          <View className="px-4 pb-2">
            <Text className={`text-xs font-semibold mb-3 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              ✨ Popular searches
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {suggestedQuestions.map((question, index) => (
                <TouchableOpacity
                  key={index}
                  className={`px-4 py-2.5 rounded-2xl mr-3 ${
                    isDarkMode 
                      ? 'bg-neutral-800/90 border-neutral-700/50 shadow-black/20' 
                      : 'bg-white border-neutral-200/60 shadow-black/5'
                  } shadow-sm border`}
                  onPress={() => handleSuggestedQuestion(question)}
                  activeOpacity={0.7}
                >
                  <Text className={`text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>
                    {question}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Animated.View 
          className={`px-4 pt-3 pb-4 ${isDarkMode ? 'bg-black' : 'bg-neutral-50'}`}
          style={{
            transform: [{
              translateY: inputAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -2]
              })
            }]
          }}
        >
          <Animated.View
            className={`flex-row items-end rounded-3xl px-4 py-3 min-h-[52px] ${
              isDarkMode ? 'bg-neutral-800/95' : 'bg-white'
            } shadow-lg`}
            style={{}}
          >
            <TextInput
              className={`flex-1 text-sm leading-5 max-h-24 py-1 mr-3 ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}
              placeholder="Ask me anything about cars..."
              placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={sendMessage}
              onFocus={() => animateInput(true)}
              onBlur={() => animateInput(false)}
              editable={!isLoading}
              returnKeyType="send"
              blurOnSubmit={false}
              multiline
              maxLength={500}
              accessibilityLabel="Message input"
            />
            {inputText.length > 0 && (
              <Text className={`absolute right-14 -top-4 text-[10px] ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {inputText.length}/500
              </Text>
            )}
            
            <TouchableOpacity
              className={`w-9 h-9 rounded-2xl items-center justify-center ${
                (inputText.trim() && !isLoading) 
                  ? 'bg-red shadow-red-500/20 shadow-md' 
                  : isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'
              }`}
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
              activeOpacity={0.8}
              style={{
                transform: [{ 
                  scale: (inputText.trim() && !isLoading) ? 1 : 0.95 
                }]
              }}
              accessibilityLabel="Send message"
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons 
                  name="arrow-up" 
                  size={18} 
                  color={(inputText.trim() && !isLoading) ? "white" : (isDarkMode ? '#9CA3AF' : '#6B7280')} 
                />
              )}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
      {showScrollToBottom && (
        <TouchableOpacity
          onPress={scrollToBottom}
            accessibilityLabel="Scroll to latest messages"
          activeOpacity={0.85}
          className="absolute bottom-28 right-5 w-11 h-11 rounded-full bg-red items-center justify-center shadow-lg"
        >
          <Ionicons name="arrow-down" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
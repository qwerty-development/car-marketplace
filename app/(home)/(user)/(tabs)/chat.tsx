import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { useGuestUser } from '@/utils/GuestUserContext';
import { useFocusEffect } from '@react-navigation/native';
import ConversationListItem from '@/components/chat/ConversationListItem';
import { useConversations } from '@/hooks/useConversations';
import { Ionicons } from '@expo/vector-icons';

type FilterType = 'sent' | 'received';

export default function ChatTabScreen() {
  const { isDarkMode } = useTheme();
  const { user, isLoaded } = useAuth();
  const { isGuest } = useGuestUser();
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('sent');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const {
    data: conversations,
    isLoading,
    refetch,
    isRefetching,
    error: conversationsError,
  } = useConversations({
    userId: user?.id ?? null,
    enabled: !!user && !isGuest,
  });

  // Filter conversations based on selected filter and search query
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];

    // Filter by sent/received
    const byFilter =
      filter === 'sent'
        ? conversations.filter((c) => c.user_id === user?.id)
        : conversations.filter((c) => c.seller_user_id === user?.id);

    // Apply search filter
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (!trimmedQuery) return byFilter;

    return byFilter.filter((c) => {
      const parts: string[] = [];
      if (c.dealership?.name) parts.push(c.dealership.name);
      if (c.dealership?.location) parts.push(c.dealership.location);
      if (c.last_message_preview) parts.push(c.last_message_preview);

      const carInfo = c.car || c.carRent;
      if (carInfo) {
        if (carInfo.make) parts.push(carInfo.make);
        if (carInfo.model) parts.push(carInfo.model);
        if (carInfo.year) parts.push(String(carInfo.year));
      }

      const plateInfo = c.numberPlate;
      if (plateInfo) {
        parts.push(`${plateInfo.letter ?? ''} ${plateInfo.digits ?? ''}`.trim());
      }

      // Also search in seller_user name if it exists
      if (c.seller_user?.name) parts.push(c.seller_user.name);
      if (c.user?.name) parts.push(c.user.name);

      return parts.some((p) => p.toLowerCase().includes(trimmedQuery));
    });
  }, [conversations, filter, searchQuery, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user && !isGuest) {
        refetch();
      }
    }, [refetch, user, isGuest])
  );

  const handleOpenConversation = useCallback(
    (conversationId: number) => {
      router.push({
        pathname: '/(home)/(user)/conversations/[conversationId]',
        params: { conversationId: conversationId.toString() },
      });
    },
    [router]
  );

  const handleStartSearch = useCallback(() => {
    setIsSearching(true);
  }, []);

  const handleCancelSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearching(false);
  }, []);

  useEffect(() => {
    if (isSearching) {
      const timeout = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [isSearching]);

  if (!isLoaded) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#000' : '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" color="#D55004" />
      </SafeAreaView>
    );
  }

  if (!user || isGuest) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          backgroundColor: isDarkMode ? '#000' : '#FFFFFF',
        }}
      >
        <Ionicons
          name="chatbubbles-outline"
          size={64}
          color={isDarkMode ? '#4B5563' : '#9CA3AF'}
          style={{ marginBottom: 16 }}
        />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: isDarkMode ? '#E2E8F0' : '#0F172A',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          {t('chat.sign_in_required_title', 'Sign in to continue')}
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: isDarkMode ? '#94A3B8' : '#475569',
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          {t(
            'chat.sign_in_required_body',
            'Create an account or sign in to message dealers about vehicles you love.'
          )}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? '#000' : '#FFFFFF',
      }}
    >
      {/* Header */}
      <View style={styles.header}>
        {isSearching ? (
          <View style={styles.searchBarRow}>
            <View
              style={[
                styles.searchInputWrapper,
                {
                  backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6',
                  borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                style={{ marginRight: 8 }}
              />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('chat.search_placeholder', 'Search chats')}
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                style={[styles.searchInput, { color: isDarkMode ? '#E5E7EB' : '#0F172A' }]}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity onPress={handleCancelSearch} activeOpacity={0.7}>
              <Text style={[styles.cancelSearchText, { color: isDarkMode ? '#E5E7EB' : '#0F172A' }]}>
                {t('common.cancel', 'Cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerTopRow}>
            <Text
              style={[
                styles.headerTitle,
                { color: isDarkMode ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              {t('chat.title', 'My Chats')}
            </Text>
            <TouchableOpacity
              style={[
                styles.searchButton,
                { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' },
              ]}
              activeOpacity={0.7}
              onPress={handleStartSearch}
            >
              <Ionicons
                name="search"
                size={20}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            onPress={() => setFilter('sent')}
            style={[
              styles.filterTab,
              filter === 'sent'
                ? styles.filterTabActive
                : { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === 'sent'
                  ? styles.filterTabTextActive
                  : { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
              ]}
            >
              {t('chat.filter_sent', 'Sent')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilter('received')}
            style={[
              styles.filterTab,
              filter === 'received'
                ? styles.filterTabActive
                : { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === 'received'
                  ? styles.filterTabTextActive
                  : { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
              ]}
            >
              {t('chat.filter_received', 'Received')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#D55004" />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingVertical: 8,
            paddingBottom: 100, // Extra padding for tab bar
          }}
          renderItem={({ item }) => (
            <ConversationListItem
              conversation={item}
              viewerRole="user"
              isDarkMode={isDarkMode}
              onPress={(conversation) => handleOpenConversation(conversation.id)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#D55004"
              colors={['#D55004']}
            />
          }
          ListEmptyComponent={
            <View
              style={{
                marginTop: 120,
                paddingHorizontal: 24,
                alignItems: 'center',
              }}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={isDarkMode ? '#4B5563' : '#9CA3AF'}
                style={{ marginBottom: 16 }}
              />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: isDarkMode ? '#E2E8F0' : '#0F172A',
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                {filter === 'sent'
                  ? t('chat.no_sent_title', 'No sent messages')
                  : t('chat.no_received_title', 'No received messages')}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: isDarkMode ? '#94A3B8' : '#475569',
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                {filter === 'sent'
                  ? t(
                      'chat.no_sent_body',
                      'Find a car you love and tap "Chat with dealer" to start a conversation.'
                    )
                  : t(
                      'chat.no_received_body',
                      'When someone messages you about your listings, conversations will appear here.'
                    )}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  cancelSearchText: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterTabActive: {
    backgroundColor: '#111',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#fff',
  },
});

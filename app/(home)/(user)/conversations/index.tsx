import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import ConversationListItem from '@/components/chat/ConversationListItem';
import { useQuery, useQueryClient } from 'react-query';
import { supabase } from '@/utils/supabase';
import { ConversationSummary } from '@/types/chat';

export default function UserConversationsScreen() {
  const { isDarkMode } = useTheme();
  const { user, isLoaded } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch user conversations
  const {
    data: conversations,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery(
    ['user-conversations', user?.id],
    async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          user_id,
          dealership_id,
          seller_user_id,
          conversation_type,
          car_id,
          car_rent_id,
          created_at,
          updated_at,
          last_message_at,
          last_message_preview,
          user_unread_count,
          seller_unread_count,
          user:users!conversations_user_id_fkey (
            id,
            name,
            email
          ),
          dealership:dealerships (
            id,
            name,
            logo,
            location,
            phone
          ),
          seller_user:users!conversations_seller_user_id_fkey (
            id,
            name,
            email
          ),
          car:cars (
            id,
            dealership_id,
            make,
            model,
            year,
            price,
            images,
            status
          ),
          carRent:cars_rent (
            id,
            dealership_id,
            make,
            model,
            year,
            price,
            images,
            status
          )
        `)
        .or(`user_id.eq.${user.id},seller_user_id.eq.${user.id}`)
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform the data to match ConversationSummary type
      return (data || []).map(conv => ({
        ...conv,
        user: Array.isArray(conv.user) ? conv.user[0] : conv.user,
        dealership: Array.isArray(conv.dealership) ? conv.dealership[0] : conv.dealership,
        seller_user: Array.isArray(conv.seller_user) ? conv.seller_user[0] : conv.seller_user,
        car: Array.isArray(conv.car) ? conv.car[0] : conv.car,
        carRent: Array.isArray(conv.carRent) ? conv.carRent[0] : conv.carRent,
      })) as ConversationSummary[];
    },
    {
      enabled: !!user?.id,
      staleTime: 30 * 1000, // Consider data fresh for 30 seconds
      cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    }
  );

  // Set up Realtime subscription for live updates (both as buyer and seller)
  useEffect(() => {
    if (!user?.id) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const handleConversationChange = (payload: any) => {
      // Debounce the invalidation to prevent too many refetches
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(() => {
        // Only invalidate if there's a new message (last_message_at changed) or new conversation
        if (payload.eventType === 'INSERT' || 
            (payload.eventType === 'UPDATE' && payload.new?.last_message_preview !== payload.old?.last_message_preview)) {
          queryClient.invalidateQueries(['user-conversations', user.id]);
        }
      }, 500); // Wait 500ms before invalidating
    };

    // Subscribe to conversations where user is buyer
    const buyerFilter = `user_id=eq.${user.id}`;
    const buyerChannel = supabase
      .channel(`user-conversations-buyer:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: buyerFilter,
        },
        handleConversationChange
      )
      .subscribe();

    // Subscribe to conversations where user is seller
    const sellerFilter = `seller_user_id=eq.${user.id}`;
    const sellerChannel = supabase
      .channel(`user-conversations-seller:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: sellerFilter,
        },
        handleConversationChange
      )
      .subscribe();

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      supabase.removeChannel(buyerChannel);
      supabase.removeChannel(sellerChannel);
    };
  }, [user?.id, queryClient]);

  const handleOpenConversation = useCallback(
    (conversationId: number) => {
      router.push({
        pathname: '/(home)/(user)/messages/[conversationId]',
        params: { conversationId: conversationId.toString() },
      });
    },
    [router]
  );

  if (!isLoaded) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" color="#D55004" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          backgroundColor: isDarkMode ? '#000000' : '#FFFFFF',
        }}
      >
        <View className="items-center">
          <View className="w-20 h-20 rounded-full bg-orange-500/10 items-center justify-center mb-4">
            <Ionicons name="lock-closed-outline" size={40} color="#D55004" />
          </View>
          <Text
            className={`text-xl font-bold mb-3 ${
              isDarkMode ? 'text-white' : 'text-black'
            }`}
            style={{ textAlign: 'center' }}
          >
            {t('chat.sign_in_required_title', 'Sign in to continue')}
          </Text>
          <Text
            className={`text-base ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}
            style={{ textAlign: 'center', lineHeight: 22 }}
          >
            {t(
              'chat.user_sign_in_required',
              'Sign in to view your conversations with dealers.'
            )}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? '#000000' : '#F8FAFC',
      }}
    >
      {/* Header Stats */}
      <View
        className={`mx-4 mt-2 mb-4 p-4 rounded-2xl ${
          isDarkMode ? 'bg-neutral-900' : 'bg-white'
        }`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            <Text
              className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {t('chat.total_conversations', 'Total Conversations')}
            </Text>
            <Text
              className={`text-3xl font-bold mt-1 ${
                isDarkMode ? 'text-white' : 'text-black'
              }`}
            >
              {conversations?.length ?? 0}
            </Text>
          </View>
          <View className="w-16 h-16 rounded-full bg-orange-500/10 items-center justify-center">
            <Ionicons name="chatbubbles" size={32} color="#D55004" />
          </View>
        </View>
        
        {/* Unread Count */}
        {conversations && conversations.length > 0 && (
          <View className="flex-row items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <View className="w-8 h-8 rounded-full bg-red-500/10 items-center justify-center mr-2">
              <Ionicons name="notifications" size={16} color="#ef4444" />
            </View>
            <Text
              className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {conversations.filter(c => (c.user_unread_count ?? 0) > 0).length}{' '}
              {t('chat.unread', 'unread')}
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#D55004" />
          <Text
            className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {t('chat.loading_conversations', 'Loading conversations...')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingBottom: 32,
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
                marginTop: 80,
                paddingHorizontal: 32,
                alignItems: 'center',
              }}
            >
              <View className="w-24 h-24 rounded-full bg-gray-100 dark:bg-neutral-900 items-center justify-center mb-6">
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={48}
                  color={isDarkMode ? '#555' : '#CCC'}
                />
              </View>
              <Text
                className={`text-xl font-bold mb-3 ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}
                style={{ textAlign: 'center' }}
              >
                {t('chat.no_conversations_title', 'No conversations yet')}
              </Text>
              <Text
                className={`text-base ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
                style={{ textAlign: 'center', lineHeight: 22 }}
              >
                {t(
                  'chat.user_no_conversations_body',
                  'When you message dealers about vehicles, conversations will appear here.'
                )}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { supabase } from '@/utils/supabase';
import { ChatService } from '@/services/ChatService';
import { ConversationSummary } from '@/types/chat';

interface UseConversationsOptions {
  userId?: string | null;
  enabled?: boolean;
  includeCarContext?: boolean;
}

const queryKey = (userId?: string | null) => [
  'conversations',
  { userId: userId ?? null },
];

export function useConversations({
  userId,
  enabled = true,
  includeCarContext = true,
}: UseConversationsOptions) {
  const queryClient = useQueryClient();

  const fetcher = useMemo(() => {
    if (userId) {
      return () => ChatService.fetchConversationsForUser(userId);
    }

    return () => Promise.resolve<ConversationSummary[]>([]);
  }, [userId]);

  const isEnabled = enabled && !!userId;

  const result = useQuery<ConversationSummary[]>(
    queryKey(userId),
    fetcher,
    {
      enabled: isEnabled,
      staleTime: 30 * 1000, // Consider data fresh for 30 seconds
      cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
      refetchOnWindowFocus: false, // Prevent refetch when switching tabs
    }
  );

  useEffect(() => {
    if (!isEnabled) return;

    const filter = `user_id=eq.${userId}`;

    // Subscribe to all conversation changes (INSERT, UPDATE, DELETE)
    // Changes include car_id and car_rent_id fields automatically
    const channel = supabase
      .channel(`conversations:${filter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter,
        },
        (payload) => {
          // Invalidate query to refetch conversations with updated car context
          queryClient.invalidateQueries(queryKey(userId));
        }
      )
      .subscribe();

    // Optional: Also listen to car table changes if car context is enabled
    // This ensures we get updates if car status/price changes
    let carChannel: any = null;
    if (includeCarContext) {
      carChannel = supabase
        .channel(`cars-realtime:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'cars',
          },
          () => {
            // Invalidate conversations when car details change
            queryClient.invalidateQueries(queryKey(userId));
          }
        )
        .subscribe();
    }

    return () => {
      // Properly cleanup channels on unmount
      channel.unsubscribe();
      supabase.removeChannel(channel);
      if (carChannel) {
        carChannel.unsubscribe();
        supabase.removeChannel(carChannel);
      }
    };
  }, [userId, isEnabled, includeCarContext, queryClient]);

  return result;
}


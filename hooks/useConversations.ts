import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

  const result = useQuery<ConversationSummary[]>({
    queryKey: queryKey(userId),
    queryFn: fetcher,
    enabled: isEnabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!isEnabled) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const handleConversationChange = (payload: any) => {
      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounce to prevent rapid refetches
      debounceTimer = setTimeout(() => {
        // Only invalidate on INSERT or when last_message_preview changes (new message)
        // Skip invalidation for read status updates (user_unread_count/seller_unread_count changes)
        if (payload.eventType === 'INSERT' ||
            (payload.eventType === 'UPDATE' && 
             payload.new?.last_message_preview !== payload.old?.last_message_preview)) {
          console.log('[useConversations] Meaningful change detected, invalidating:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: queryKey(userId) });
        }
      }, 300);
    };

    // Subscribe to conversations where user is the buyer (user_id)
    const buyerFilter = `user_id=eq.${userId}`;
    const buyerChannel = supabase
      .channel(`conversations-buyer:${userId}`)
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

    // Subscribe to conversations where user is the seller (seller_user_id)
    const sellerFilter = `seller_user_id=eq.${userId}`;
    const sellerChannel = supabase
      .channel(`conversations-seller:${userId}`)
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
      // Cleanup timer and channels
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      buyerChannel.unsubscribe();
      supabase.removeChannel(buyerChannel);
      sellerChannel.unsubscribe();
      supabase.removeChannel(sellerChannel);
    };
  }, [userId, isEnabled, queryClient]);

  return result;
}


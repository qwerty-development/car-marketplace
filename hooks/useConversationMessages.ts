import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from 'react-query';
import { ChatService } from '@/services/ChatService';
import { ChatMessage } from '@/types/chat';
import { supabase } from '@/utils/supabase';

const PAGE_SIZE = 40;

export function useConversationMessages(conversationId?: number | string | null) {
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () =>
      conversationId != null
        ? (['conversationMessages', String(conversationId)] as const)
        : (['conversationMessages'] as const),
    [conversationId]
  );

  const result = useInfiniteQuery<ChatMessage[]>(
    queryKey,
    ({ pageParam }) => {
      if (conversationId == null) return Promise.resolve<ChatMessage[]>([]);
      return ChatService.fetchMessages(conversationId, {
        before: pageParam as string | undefined,
        limit: PAGE_SIZE,
      });
    },
    {
      enabled: conversationId != null,
      staleTime: 0, // Always consider data stale for real-time chat
      cacheTime: 0, // Don't cache - always fetch fresh for real-time
      refetchOnMount: 'always', // Always refetch when conversation screen opens
      refetchOnWindowFocus: true, // Refetch when switching tabs
      getNextPageParam: (lastPage) => {
        if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
        return lastPage[0]?.created_at;
      },
    }
  );

  const flatMessages = useMemo(() => {
    if (!result.data?.pages) return [] as ChatMessage[];
    // Flatten pages - ChatService.fetchMessages already returns messages in chronological order
    // (oldest first), so no need to reverse. For pagination, older pages should come first.
    const allPages = [...result.data.pages].reverse(); // Reverse page order (older pages first)
    return allPages.flat();
  }, [result.data?.pages]);

  useEffect(() => {
    if (conversationId == null) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const channelKey = String(conversationId);
    const channel = supabase
      .channel(`messages:conversation:${channelKey}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${channelKey}`,
        },
        (payload) => {
          // Clear existing timer
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          // For INSERT events (new messages), invalidate immediately for real-time feel
          if (payload.eventType === 'INSERT') {
            console.log('[useConversationMessages] New message received, refreshing immediately');
            queryClient.invalidateQueries(queryKey);
            return;
          }

          // For UPDATE/DELETE events, debounce to prevent rapid refetches (e.g., read receipts)
          debounceTimer = setTimeout(() => {
            console.log('[useConversationMessages] Message change:', payload.eventType);
            queryClient.invalidateQueries(queryKey);
          }, 300);
        }
      )
      .subscribe((status) => {
        // When subscription is ready, force a refetch to catch any messages 
        // that arrived between initial fetch and subscription becoming active
        if (status === 'SUBSCRIBED') {
          console.log('[useConversationMessages] Realtime subscribed, syncing messages');
          queryClient.invalidateQueries(queryKey);
        }
      });

    return () => {
      // Cleanup timer and channel
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, queryKey]);

  return {
    ...result,
    messages: flatMessages,
  };
}

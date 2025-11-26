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
      staleTime: 30 * 1000, // Consider data fresh for 30 seconds
      cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      refetchOnWindowFocus: false, // Prevent refetch when switching tabs
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

          // Debounce to prevent multiple rapid refetches
          debounceTimer = setTimeout(() => {
            // Only invalidate on INSERT (new messages) or UPDATE (read status)
            // Skip invalidation for rapid successive updates
            console.log('[useConversationMessages] Message change:', payload.eventType);
            queryClient.invalidateQueries(queryKey);
          }, 300);
        }
      )
      .subscribe();

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

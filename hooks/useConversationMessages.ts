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
    return result.data.pages.flat();
  }, [result.data?.pages]);

  useEffect(() => {
    if (conversationId == null) return;

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
        () => {
          // Debounce invalidation to prevent multiple rapid refetches
          queryClient.invalidateQueries(queryKey);
        }
      )
      .subscribe();

    return () => {
      // Properly cleanup channel on unmount
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, queryKey]);

  return {
    ...result,
    messages: flatMessages,
  };
}

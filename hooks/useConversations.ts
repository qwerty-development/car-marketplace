import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { supabase } from '@/utils/supabase';
import { ChatService } from '@/services/ChatService';
import { ConversationSummary } from '@/types/chat';

interface UseConversationsOptions {
  userId?: string | null;
  enabled?: boolean;
}

const queryKey = (userId?: string | null) => [
  'conversations',
  { userId: userId ?? null },
];

export function useConversations({
  userId,
  enabled = true,
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
        () => {
          queryClient.invalidateQueries(queryKey(userId));
        }
      )
      .subscribe();

    return () => {
      // Properly cleanup channel on unmount
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId, isEnabled, queryClient]);

  return result;
}


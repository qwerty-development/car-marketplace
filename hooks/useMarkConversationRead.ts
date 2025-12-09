import { useMutation, useQueryClient } from 'react-query';
import { ChatService } from '@/services/ChatService';

interface MarkReadVariables {
  conversationId: string | number;
  viewerRole: 'user' | 'dealer' | 'seller_user';
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, MarkReadVariables>(
    ({ conversationId, viewerRole }) =>
      ChatService.markConversationRead(conversationId, viewerRole),
    {
      onMutate: (variables) => {
        console.log('[useMarkConversationRead] mutate', variables);
      },
      onSuccess: (_, variables) => {
        console.log('[useMarkConversationRead] success', variables);
        // Only invalidate the specific conversation messages, not all conversations
        // The conversation list will be updated via realtime subscription
        const cacheKey = String(variables.conversationId);
        queryClient.invalidateQueries(['conversationMessages', cacheKey]);
        // Also refresh conversation summaries so unread badges drop when returning to the list
        queryClient.invalidateQueries('conversations');
      },
      onError: (error, variables) => {
        console.warn('[useMarkConversationRead] failed', { error, variables });
      },
    }
  );
}


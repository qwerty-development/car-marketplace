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
      onSuccess: (_, variables) => {
        // Only invalidate the specific conversation messages, not all conversations
        // The conversation list will be updated via realtime subscription
        const cacheKey = String(variables.conversationId);
        queryClient.invalidateQueries(['conversationMessages', cacheKey]);
        // Don't invalidate all conversations - let realtime handle it
      },
    }
  );
}


import { useMutation, useQueryClient } from 'react-query';
import { ChatService } from '@/services/ChatService';

interface MarkReadVariables {
  conversationId: string | number;
  viewerRole: 'user' | 'dealer';
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, MarkReadVariables>(
    ({ conversationId, viewerRole }) =>
      ChatService.markConversationRead(conversationId, viewerRole),
    {
      onSuccess: (_, variables) => {
        const cacheKey = String(variables.conversationId);
        queryClient.invalidateQueries(['conversationMessages', cacheKey]);
        queryClient.invalidateQueries('conversations');
      },
    }
  );
}


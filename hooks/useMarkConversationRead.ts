import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatService } from '@/services/ChatService';

interface MarkReadVariables {
  conversationId: string | number;
  viewerRole: 'user' | 'dealer' | 'seller_user';
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, MarkReadVariables>({
    mutationFn: ({ conversationId, viewerRole }) =>
      ChatService.markConversationRead(conversationId, viewerRole),
    onMutate: (variables) => {
      console.log('[useMarkConversationRead] mutate', variables);
    },
    onSuccess: (_, variables) => {
      console.log('[useMarkConversationRead] success', variables);
      const cacheKey = String(variables.conversationId);
      queryClient.invalidateQueries({ queryKey: ['conversationMessages', cacheKey] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error, variables) => {
      console.warn('[useMarkConversationRead] failed', { error, variables });
    },
  });
}


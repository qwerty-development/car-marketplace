import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatService } from '@/services/ChatService';
import { ChatMessage, SendMessagePayload } from '@/types/chat';

export function useSendMessage(conversationId: string | number) {
  const queryClient = useQueryClient();
  const cacheKey = conversationId != null ? String(conversationId) : null;

  return useMutation<ChatMessage, Error, SendMessagePayload>({
    mutationFn: (payload) => ChatService.sendMessage(payload),
    onSuccess: () => {
      if (cacheKey) {
        queryClient.invalidateQueries({ queryKey: ['conversationMessages', cacheKey] });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

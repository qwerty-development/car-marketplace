import { useMutation, useQueryClient } from 'react-query';
import { ChatService } from '@/services/ChatService';
import { ChatMessage, SendMessagePayload } from '@/types/chat';

export function useSendMessage(conversationId: string | number) {
  const queryClient = useQueryClient();
  const cacheKey = conversationId != null ? String(conversationId) : null;

  return useMutation<ChatMessage, Error, SendMessagePayload>(
    (payload) => ChatService.sendMessage(payload),
    {
      onSuccess: () => {
        if (cacheKey) {
          queryClient.invalidateQueries(['conversationMessages', cacheKey]);
        }
        queryClient.invalidateQueries('conversations');
      },
    }
  );
}

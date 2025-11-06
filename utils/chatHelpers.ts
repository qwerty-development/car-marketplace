import Toast from 'react-native-toast-message';
import { ChatService } from '@/services/ChatService';

interface StartDealerChatOptions {
  dealershipId?: number | null;
  userId?: string | null;
  isGuest: boolean;
  router: {
    push: (params: { pathname: string; params?: Record<string, any> }) => void;
  };
  t: (key: string, defaultMessage?: string) => string;
  onAuthRequired?: () => void;
  setLoading?: (loading: boolean) => void;
}

export async function startDealerChat({
  dealershipId,
  userId,
  isGuest,
  router,
  t,
  onAuthRequired,
  setLoading,
}: StartDealerChatOptions): Promise<{ started: boolean; conversationId?: number }> {
  if (isGuest || !userId) {
    onAuthRequired?.();
    return { started: false };
  }

  if (!dealershipId) {
    Toast.show({
      type: 'error',
      text1: t('chat.dealership_not_found', 'Dealer unavailable'),
      text2: t(
        'chat.dealership_not_found_body',
        'We could not find dealership details for this listing.'
      ),
    });
    return { started: false };
  }

  try {
    setLoading?.(true);
    const conversation = await ChatService.ensureConversation({
      userId,
      dealershipId,
    });

    router.push({
      pathname: '/(home)/(user)/messages/[conversationId]',
      params: { conversationId: conversation.id.toString() },
    });

    return { started: true, conversationId: conversation.id };
  } catch (error: any) {
    console.error('[Chat] Failed to start conversation', error);
    Toast.show({
      type: 'error',
      text1: t('chat.start_failed', 'Unable to start chat'),
      text2: error?.message ?? t('chat.try_again', 'Try again in a moment.'),
    });
    return { started: false };
  } finally {
    setLoading?.(false);
  }
}


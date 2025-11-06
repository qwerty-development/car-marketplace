export interface ConversationSummary {
  id: number;
  user_id: string;
  dealership_id: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  user_unread_count: number;
  dealer_unread_count: number;
  user?: ChatUserParticipant | null;
  dealership?: ChatDealershipParticipant | null;
}

export interface ChatUserParticipant {
  id: string;
  name: string | null;
  email?: string | null;
}

export interface ChatDealershipParticipant {
  id: number;
  name: string | null;
  logo?: string | null;
  phone?: string | null;
  location?: string | null;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: string;
  sender_role: 'user' | 'dealer';
  body: string | null;
  media_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface SendMessagePayload {
  conversationId: number | string;
  senderId: string;
  senderRole: 'user' | 'dealer';
  body?: string;
  mediaUrl?: string;
}

export interface CreateConversationParams {
  userId: string;
  dealershipId: number;
}

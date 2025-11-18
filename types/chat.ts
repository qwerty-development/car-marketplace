export interface ConversationSummary {
  id: number;
  user_id: string;
  dealership_id: number;
  car_id: number | null;
  car_rent_id: number | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  user_unread_count: number;
  dealer_unread_count: number;
  user?: ChatUserParticipant | null;
  dealership?: ChatDealershipParticipant | null;
  car?: CarListingContext | null;
  carRent?: RentalCarContext | null;
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

export interface CarListingContext {
  id: number;
  dealership_id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  images: string[] | null;
  status: 'available' | 'sold' | 'pending';
}

export interface RentalCarContext {
  id: number;
  dealership_id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  images: string[] | null;
  status: 'available' | 'unavailable';
}

export interface CreateConversationParams {
  userId: string;
  dealershipId: number;
  carId?: number | null;
  carRentId?: number | null;
}

export type CarContext = CarListingContext | RentalCarContext | null;

/**
 * Validates that exactly one car type is provided (XOR constraint)
 * @param carId - Car listing ID
 * @param carRentId - Rental car ID
 * @throws Error if both or neither car types are provided
 */
export function validateCarContext(carId?: number | null, carRentId?: number | null): {
  isValid: boolean;
  error?: string;
} {
  const hasCarId = carId !== null && carId !== undefined;
  const hasCarRentId = carRentId !== null && carRentId !== undefined;

  if (hasCarId && hasCarRentId) {
    return {
      isValid: false,
      error: 'Cannot specify both car_id and car_rent_id. Provide only one.',
    };
  }

  if (!hasCarId && !hasCarRentId) {
    return {
      isValid: false,
      error: 'Must specify either car_id or car_rent_id.',
    };
  }

  return { isValid: true };
}

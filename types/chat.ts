export interface ConversationSummary {
  id: number;
  user_id: string;
  dealership_id: number | null;
  seller_user_id: string | null;
  conversation_type: 'user_dealer' | 'user_user';
  car_id: number | null;
  car_rent_id: number | null;
  number_plate_id: number | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  user_unread_count: number;
  seller_unread_count: number;
  user?: ChatUserParticipant | null;
  dealership?: ChatDealershipParticipant | null;
  seller_user?: ChatUserParticipant | null;
  car?: CarListingContext | null;
  carRent?: RentalCarContext | null;
  numberPlate?: NumberPlateContext | null;
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
  sender_role: 'user' | 'dealer' | 'seller_user';
  body: string | null;
  media_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface SendMessagePayload {
  conversationId: number | string;
  senderId: string;
  senderRole: 'user' | 'dealer' | 'seller_user';
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
  status: 'available' | 'sold' | 'pending' | 'deleted';
}

export interface RentalCarContext {
  id: number;
  dealership_id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  images: string[] | null;
  status: 'available' | 'unavailable' | 'rented' | 'deleted';
}

export interface NumberPlateContext {
  id: number;
  letter: string;
  digits: string;
  price: number;
  picture: string | null;
  status: string;
  user_id?: string | null;
  dealership_id?: number | null;
}

export interface CreateConversationParams {
  userId: string;
  dealershipId?: number | null;
  sellerUserId?: string | null;
  conversationType: 'user_dealer' | 'user_user';
  carId?: number | null;
  carRentId?: number | null;
  numberPlateId?: number | null;
}

export type CarContext = CarListingContext | RentalCarContext | null;

/**
 * Validates that exactly one listing type is provided (XOR constraint)
 * @param carId - Car listing ID
 * @param carRentId - Rental car ID
 * @param numberPlateId - Number plate ID
 * @throws Error if multiple or no listing types are provided
 */
export function validateListingContext(
  carId?: number | null, 
  carRentId?: number | null,
  numberPlateId?: number | null
): {
  isValid: boolean;
  error?: string;
} {
  const hasCarId = carId !== null && carId !== undefined;
  const hasCarRentId = carRentId !== null && carRentId !== undefined;
  const hasNumberPlateId = numberPlateId !== null && numberPlateId !== undefined;

  const count = [hasCarId, hasCarRentId, hasNumberPlateId].filter(Boolean).length;

  if (count > 1) {
    return {
      isValid: false,
      error: 'Cannot specify multiple listing types. Provide only one of car_id, car_rent_id, or number_plate_id.',
    };
  }

  if (count === 0) {
    return {
      isValid: false,
      error: 'Must specify exactly one listing type: car_id, car_rent_id, or number_plate_id.',
    };
  }

  return { isValid: true };
}

/**
 * @deprecated Use validateListingContext instead
 * Validates that exactly one car type is provided (XOR constraint)
 * @param carId - Car listing ID
 * @param carRentId - Rental car ID
 * @throws Error if both or neither car types are provided
 */
export function validateCarContext(carId?: number | null, carRentId?: number | null): {
  isValid: boolean;
  error?: string;
} {
  return validateListingContext(carId, carRentId, null);
}

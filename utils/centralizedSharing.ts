import { Share, Alert, Platform } from 'react-native';

interface ShareableContent {
  id: number | string;
  type: 'car' | 'autoclip' | 'dealership';
  title: string;
  message: string;
}

/**
 * Centralized sharing function that handles platform-specific sharing logic
 * - iOS: URL included in message text
 * - Android: URL passed as separate url parameter
 */
export const shareContent = async ({
  id, 
  type, 
  title, 
  message
}: ShareableContent): Promise<void> => {
  try {
    // Construct path based on content type
    const pathSegment = type === 'car' ? 'cars' : 
                        type === 'autoclip' ? 'clips' : 
                        type === 'dealership' ? 'dealers' : '';
    
    // Create consistent URL format
    const shareUrl = `https://www.fleetapp.me/${pathSegment}/${id}`;
    
    if (Platform.OS === 'ios') {
      // iOS: Include URL in message text (iOS handles this well)
      await Share.share({
        message: `${message}\n\n${shareUrl}`,
        title: title
      });
    } else {
      // Android: Include URL in message text for better reliability
      await Share.share({
        message: `${message}\n\n${shareUrl}`,
        title: title
      });
    }
  } catch (error) {
    console.error('Share error:', error);
    Alert.alert('Error', 'Failed to share content');
  }
};

/**
 * Share car content with pre-formatted message
 */
export const shareCar = async (car: any): Promise<void> => {
  const message = `Check out this ${car.year} ${car.make} ${car.model} for $${
    car.price ? car.price.toLocaleString() : "N/A"
  }! at ${car.dealership_name || "Dealership"} in ${
    car.dealership_location || "Location"
  }`;

  await shareContent({
    id: car.id,
    type: 'car',
    title: `${car.year} ${car.make} ${car.model}`,
    message: message
  });
};

/**
 * Share autoclip content with pre-formatted message
 */
export const shareAutoclip = async (autoclip: any): Promise<void> => {
  const message = `Check out this ${autoclip.car.year} ${autoclip.car.make} ${autoclip.car.model} video on Fleet!${
    autoclip.description ? `\n\n${autoclip.description}` : ''
  }`;

  await shareContent({
    id: autoclip.id,
    type: 'autoclip',
    title: `${autoclip.car.year} ${autoclip.car.make} ${autoclip.car.model} - Video`,
    message: message
  });
};

/**
 * Share dealership content with pre-formatted message
 */
export const shareDealership = async (dealership: any): Promise<void> => {
  const message = `Check out ${dealership.name} on Fleet! Located in ${dealership.location || 'Location'}`;

  await shareContent({
    id: dealership.id,
    type: 'dealership',
    title: dealership.name,
    message: message
  });
};

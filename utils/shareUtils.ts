// utils/shareUtils.ts
import { Share, Alert, Platform } from 'react-native';

interface ShareableContent {
  id: number | string;
  type: 'car' | 'autoclip' | 'dealership';
  title: string;
  message: string;
}

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
    
    // Platform-specific sharing to ensure Android reads URLs properly
    if (Platform.OS === 'android') {
      // Android: Use both message and url parameters for better compatibility
      await Share.share({
        message: `${message}\n\n${shareUrl}`,
        url: shareUrl,
        title: title
      });
    } else {
      // iOS: Can handle URL in message or as separate parameter
      await Share.share({
        message: `${message}\n\n${shareUrl}`,
        url: shareUrl,
        title: title
      });
    }
  } catch (error) {
    console.error('Share error:', error);
    Alert.alert('Error', 'Failed to share content');
  }
};
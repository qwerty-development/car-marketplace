import { Alert, Platform, Linking } from "react-native";
import i18n from "@/utils/i18n";

/**
 * Opens WhatsApp with a given phone number and optional message
 * @param phoneNumber - The phone number to message (without country code)
 * @param message - Optional message text to pre-populate
 * @param countryCode - Country code (default: '961')
 */
const openWhatsApp = (phoneNumber:any, message = '', countryCode = '961') => {
  if (!phoneNumber) {
    Alert.alert(i18n.t('common.error'), i18n.t('common.phone_not_available'));
    return;
  }

  // Clean the phone number (remove any non-numeric characters)
  const cleanedNumber = phoneNumber.toString().replace(/\D/g, '');

  // Format based on platform
  if (Platform.OS === 'ios') {
    // iOS implementation
    const formattedNumber = `${countryCode}${cleanedNumber}`;

    // First try app URL scheme
    Linking.canOpenURL(`whatsapp://send?phone=${formattedNumber}`)
      .then(supported => {
        if (supported) {
          return Linking.openURL(`whatsapp://send?phone=${formattedNumber}${message ? `&text=${encodeURIComponent(message)}` : ''}`);
        } else {
          // Fallback to web URL (different format for iOS)
          return Linking.openURL(`https://api.whatsapp.com/send?phone=${formattedNumber}${message ? `&text=${encodeURIComponent(message)}` : ''}`);
        }
      })
      .catch(() => {
        Alert.alert(
          i18n.t('whatsapp.not_available'),
          i18n.t('whatsapp.install_message'),
          [
            { text: i18n.t('common.ok') },
            {
              text: i18n.t('whatsapp.open_app_store'),
              onPress: () => Linking.openURL('https://apps.apple.com/app/whatsapp-messenger/id310633997')
            }
          ]
        );
      });
  } else {
    // Android implementation
    const url = `whatsapp://send?phone=+${countryCode}${cleanedNumber}${message ? `&text=${encodeURIComponent(message)}` : ''}`;

    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          // Fallback to web version
          const webUrl = `https://wa.me/${countryCode}${cleanedNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
          return Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Alert.alert(
          i18n.t('common.error'),
          i18n.t('whatsapp.unable_to_open')
        );
      });
  }
};

export default openWhatsApp;
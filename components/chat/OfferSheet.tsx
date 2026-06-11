import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/utils/ThemeContext';

interface OfferSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void> | void;
  /** Listing price used to show the 85% floor hint. */
  listingPrice: number | null;
  minRatio?: number;
  isCounter?: boolean;
  busy?: boolean;
}

const formatAmount = (value: number) =>
  `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Amount entry sheet for creating or countering an offer (US-12). Blocks
 * obviously-low buyer amounts client-side; the RPC is the enforcement layer.
 */
export default function OfferSheet({
  visible,
  onClose,
  onSubmit,
  listingPrice,
  minRatio = 0.85,
  isCounter = false,
  busy = false,
}: OfferSheetProps) {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setError(null);
    }
  }, [visible]);

  const minAmount =
    listingPrice && listingPrice > 0 ? Math.round(listingPrice * minRatio * 100) / 100 : null;

  const handleSubmit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('offers.invalidAmount'));
      return;
    }
    setError(null);
    await onSubmit(value);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/50" onPress={busy ? undefined : onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className={`rounded-t-3xl ${isDarkMode ? 'bg-neutral-900' : 'bg-white'} px-5 pt-5 pb-8`}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Ionicons name="pricetags" size={20} color="#D55004" style={{ marginRight: 8 }} />
                <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {isCounter ? t('offers.counterOffer') : t('offers.makeOffer')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                disabled={busy}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>

            {listingPrice != null && listingPrice > 0 && (
              <Text className={`text-sm mb-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {t('offers.listedAt', { price: formatAmount(listingPrice) })}
                {minAmount != null && !isCounter
                  ? ` · ${t('offers.minOffer', { amount: formatAmount(minAmount) })}`
                  : ''}
              </Text>
            )}

            <TextInput
              value={amount}
              onChangeText={(v) => {
                setAmount(v.replace(/[^0-9.]/g, ''));
                setError(null);
              }}
              placeholder={t('offers.amountPlaceholder')}
              placeholderTextColor={isDarkMode ? '#737373' : '#A3A3A3'}
              keyboardType="numeric"
              autoFocus
              editable={!busy}
              className={`rounded-xl px-4 py-3 text-xl font-bold ${
                isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
              }`}
            />
            {error && <Text className="text-red-500 text-sm mt-2">{error}</Text>}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={busy || !amount}
              className="bg-red py-4 rounded-xl items-center mt-4"
              style={{ opacity: busy || !amount ? 0.6 : 1 }}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {isCounter ? t('offers.sendCounter') : t('offers.sendOffer')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

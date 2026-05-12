// components/GiveawayModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { supabase } from '@/utils/supabase';
import { useTranslation } from 'react-i18next';

interface GiveawayModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: (entry: { instagram_handle: string | null; tiktok_handle: string | null }) => void;
}

export default function GiveawayModal({ isVisible, onClose, onSuccess }: GiveawayModalProps) {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trimHandle = (val: string) => val.trim().replace(/^@/, '');

  const cleanInstagram = trimHandle(instagram);
  const cleanTiktok = trimHandle(tiktok);
  const canSubmit = cleanInstagram.length > 0 || cleanTiktok.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id) return;
    setLoading(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('giveaway_entries')
      .insert({
        user_id: user.id,
        instagram_handle: cleanInstagram.length > 0 ? cleanInstagram : null,
        tiktok_handle: cleanTiktok.length > 0 ? cleanTiktok : null,
      })
      .select('instagram_handle, tiktok_handle')
      .single();

    setLoading(false);

    if (insertError) {
      setError(t('giveaway.error_submit'));
      return;
    }

    setInstagram('');
    setTiktok('');
    onSuccess(data);
  };

  const handleClose = () => {
    setInstagram('');
    setTiktok('');
    setError('');
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.card, isDarkMode && styles.cardDark]}>

              {/* Gift icon header */}
              <View style={styles.iconContainer}>
                <Ionicons name="gift" size={40} color="#fff" />
              </View>

              <Text style={styles.title}>{t('giveaway.title')}</Text>
              <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
                {t('giveaway.subtitle')}
              </Text>

              {/* Instagram */}
              {/* Instagram */}
              <View style={[styles.inputWrapper, isDarkMode && styles.inputWrapperDark]}>
                <Ionicons name="logo-instagram" size={20} color="#E1306C" style={styles.inputIcon} />
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={[styles.input, isDarkMode && styles.inputDark]}
                  placeholder={t('giveaway.instagram_placeholder')}
                  placeholderTextColor={isDarkMode ? '#666' : '#bbb'}
                  value={instagram}
                  onChangeText={setInstagram}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* TikTok */}
              <View style={[styles.inputWrapper, isDarkMode && styles.inputWrapperDark]}>
                <Ionicons name="logo-tiktok" size={20} color="#010101" style={[styles.inputIcon, { color: isDarkMode ? '#fff' : '#010101' }]} />
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={[styles.input, isDarkMode && styles.inputDark]}
                  placeholder={t('giveaway.tiktok_placeholder')}
                  placeholderTextColor={isDarkMode ? '#666' : '#bbb'}
                  value={tiktok}
                  onChangeText={setTiktok}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={[styles.hint, isDarkMode && styles.hintDark]}>
                {t('giveaway.at_least_one_hint')}
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* Submit button */}
              <TouchableOpacity
                style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit || loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>{t('giveaway.enter_button')}</Text>
                )}
              </TouchableOpacity>

              {/* Skip link */}
              <TouchableOpacity onPress={handleClose} style={styles.skipButton}>
                <Text style={[styles.skipText, isDarkMode && styles.skipTextDark]}>
                  {t('giveaway.skip')}
                </Text>
              </TouchableOpacity>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  card: {
    width: '88%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  cardDark: {
    backgroundColor: '#1a1a1a',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D55004',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#D55004',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  subtitleDark: {
    color: '#aaa',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    width: '100%',
    height: 50,
  },
  inputWrapperDark: {
    backgroundColor: '#2a2a2a',
  },
  inputIcon: {
    marginRight: 6,
  },
  atSign: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D55004',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 12,
    color: '#000',
  },
  inputDark: {
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  hintDark: {
    color: '#666',
  },
  errorText: {
    fontSize: 13,
    color: '#e53e3e',
    textAlign: 'center',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#D55004',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#888',
    textDecorationLine: 'underline',
  },
  skipTextDark: {
    color: '#666',
  },
});

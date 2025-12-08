import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageComposerProps {
  onSend: (message: string) => Promise<void> | void;
  onAttachPress?: () => void;
  isSending?: boolean;
  isDarkMode?: boolean;
  placeholder?: string;
}

export default function MessageComposer({
  onSend,
  onAttachPress,
  isSending = false,
  isDarkMode = false,
  placeholder = 'Type a message…',
}: MessageComposerProps) {
  const [message, setMessage] = useState('');

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;

    try {
      await onSend(trimmed);
      setMessage('');
    } catch (error) {
      // Error handling delegated to caller (toast, etc.)
    }
  }, [message, onSend, isSending]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#0F172A' : '#F9FAFB' },
      ]}
    >
      {onAttachPress ? (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onAttachPress}
          disabled={isSending}
        >
          <Ionicons
            name="attach-outline"
            size={22}
            color={isDarkMode ? '#E5E7EB' : '#6B7280'}
          />
        </TouchableOpacity>
      ) : null}

      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={placeholder}
        placeholderTextColor={isDarkMode ? '#64748B' : '#9CA3AF'}
        multiline
        numberOfLines={1}
        maxLength={1000}
        style={[
          styles.input,
          {
            color: isDarkMode ? '#F8FAFC' : '#1F2937',
            backgroundColor: isDarkMode ? '#1E293B' : '#F3F4F6',
            borderColor: isDarkMode ? '#334155' : '#E5E7EB',
          },
        ]}
        editable={!isSending}
        onSubmitEditing={handleSend}
        returnKeyType="send"
      />

      <TouchableOpacity
        style={[
          styles.sendButton,
          {
            backgroundColor: message.trim()
              ? '#D55004'
              : isDarkMode
              ? '#334155'
              : '#E2E8F0',
          },
        ]}
        onPress={handleSend}
        disabled={isSending || !message.trim()}
        activeOpacity={0.8}
      >
        {isSending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons
            name="paper-plane"
            size={18}
            color={message.trim() ? '#fff' : '#9CA3AF'}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  iconButton: {
    height: 48,
    width: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 140,
    textAlignVertical: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sendButton: {
    marginLeft: 10,
    height: 48,
    width: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D55004',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});


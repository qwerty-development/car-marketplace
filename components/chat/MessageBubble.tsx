import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  isDarkMode?: boolean;
  onPressAttachment?: (url: string) => void;
}

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MessageBubble({
  message,
  isOwn,
  isDarkMode = false,
  onPressAttachment,
}: MessageBubbleProps) {
  const hasAttachment = !!message.media_url;

  return (
    <View
      style={[
        styles.container,
        {
          justifyContent: isOwn ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isOwn ? '#D55004' : isDarkMode ? '#2A2A2A' : '#FFFFFF',
            borderBottomRightRadius: isOwn ? 6 : 20,
            borderBottomLeftRadius: isOwn ? 20 : 6,
            borderWidth: isOwn ? 0 : 1,
            borderColor: isDarkMode ? '#3A3A3A' : '#E5E7EB',
          },
        ]}
      >
        {message.body ? (
          <Text
            style={[
              styles.text,
              { color: isOwn ? '#fff' : isDarkMode ? '#E5E7EB' : '#111827' },
            ]}
          >
            {message.body}
          </Text>
        ) : null}

        {hasAttachment ? (
          <TouchableOpacity
            onPress={() => {
              if (message.media_url) {
                onPressAttachment?.(message.media_url);
              }
            }}
            style={[
              styles.attachment,
              {
                backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(30,64,175,0.12)',
              },
            ]}
          >
            <Ionicons
              name="attach-outline"
              size={18}
              color={isOwn ? '#fff' : '#1D4ED8'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.attachmentText,
                { color: isOwn ? '#fff' : '#1D4ED8' },
              ]}
              numberOfLines={1}
            >
              {message.media_url?.split('/').pop() ?? 'Attachment'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.metaRow}>
          <Text
            style={[
              styles.time,
              { color: isOwn ? 'rgba(255,255,255,0.7)' : '#6B7280' },
            ]}
          >
            {formatTime(message.created_at)}
          </Text>

          {isOwn ? (
            <Ionicons
              name={message.is_read ? 'checkmark-done-outline' : 'checkmark-outline'}
              size={16}
              color={message.is_read ? '#C7D2FE' : 'rgba(255,255,255,0.7)'}
              style={{ marginLeft: 6 }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  attachmentText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});


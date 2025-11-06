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
            backgroundColor: isOwn ? '#D55004' : isDarkMode ? '#1F2937' : '#F3F4F6',
            borderBottomRightRadius: isOwn ? 4 : 18,
            borderBottomLeftRadius: isOwn ? 18 : 4,
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
    marginBottom: 12,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  time: {
    fontSize: 11,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  attachmentText: {
    fontSize: 13,
    flex: 1,
  },
});


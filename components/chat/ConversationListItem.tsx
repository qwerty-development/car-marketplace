import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConversationSummary } from '@/types/chat';
import { useUserName } from '@/hooks/useUserName';
import { useTranslation } from 'react-i18next';
import CachedImage from '@/utils/CachedImage';

interface ConversationListItemProps {
  conversation: ConversationSummary;
  viewerRole: 'user' | 'dealer';
  onPress?: (conversation: ConversationSummary) => void;
  isDarkMode?: boolean;
}

const FALLBACK_COLORS = ['#D55004', '#2563EB', '#16A34A', '#9333EA', '#EA580C'];

function formatTimestamp(timestamp?: string | null) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getDisplayInfo(
  conversation: ConversationSummary,
  viewerRole: 'user' | 'dealer',
  fetchedUserName?: string | null
) {
  const carInfo = conversation.car || conversation.carRent;
  const plateInfo = conversation.numberPlate;
  
  // Determine listing label
  let listingLabel = '';
  if (carInfo) {
    listingLabel = `${carInfo.make} ${carInfo.model} (${carInfo.year})${
      conversation.carRent ? ' • For Rent' : ''
    }`;
  } else if (plateInfo) {
    listingLabel = `Plate: ${plateInfo.letter} ${plateInfo.digits}`;
  }

  if (viewerRole === 'user') {
    // For user_user conversations, show the seller user
    if (conversation.conversation_type === 'user_user') {
      const sellerUser = conversation.seller_user;
      const emailUsername = sellerUser?.email?.split('@')[0];
      const resolvedName = sellerUser?.name || emailUsername;
      const fallbackLabel = resolvedName ?? 'Seller';

      return {
        title: fallbackLabel,
        subtitle: listingLabel || sellerUser?.email || '',
        avatarUrl: null,
        fallbackLetter: fallbackLabel.charAt(0).toUpperCase(),
        carInfo: carInfo ? listingLabel : null,
        plateInfo: plateInfo ? listingLabel : null,
        conversationType: 'user_user' as const,
      };
    }

    // For user_dealer conversations, show the dealer
    const dealer = conversation.dealership;
    return {
      title: dealer?.name ?? 'Dealer',
      subtitle: listingLabel || dealer?.location || dealer?.phone || '',
      avatarUrl: dealer?.logo ?? null,
      fallbackLetter: dealer?.name?.[0]?.toUpperCase() ?? 'D',
      carInfo: carInfo ? listingLabel : null,
      plateInfo: plateInfo ? listingLabel : null,
      conversationType: 'user_dealer' as const,
    };
  }

  // Dealer view: show the buyer user
  const user = conversation.user;
  const emailUsername = user?.email?.split('@')[0];
  const resolvedName = fetchedUserName || user?.name || emailUsername;
  const idSnippet = conversation.user_id
    ? conversation.user_id.slice(0, 8)
    : 'Customer';
  const fallbackLabel = resolvedName ?? idSnippet ?? 'Customer';

  return {
    title: fallbackLabel,
    subtitle: user?.email ?? '',
    avatarUrl: null,
    fallbackLetter: fallbackLabel.charAt(0).toUpperCase(),
    carInfo: carInfo ? listingLabel : null,
    plateInfo: plateInfo ? listingLabel : null,
    conversationType: conversation.conversation_type,
  };
}

export default function ConversationListItem({
  conversation,
  viewerRole,
  onPress,
  isDarkMode = false,
}: ConversationListItemProps) {
  const { t } = useTranslation();
  // Try to resolve user name via RPC when missing (helps dealer view under RLS)
  const { data: fetchedName } = useUserName(
    conversation.user_id,
    viewerRole === 'dealer' && (!conversation.user || !conversation.user.name)
  );

  const info = useMemo(
    () => getDisplayInfo(conversation, viewerRole, fetchedName ?? undefined),
    [conversation, viewerRole, fetchedName]
  );

  const unreadCount =
    viewerRole === 'user'
      ? conversation.user_unread_count ?? 0
      : conversation.seller_unread_count ?? 0;

  const preview =
    conversation.last_message_preview ||
    t('chat.no_messages_yet', 'No messages yet');

  const previewDisplay =
    preview.length > 120 ? `${preview.slice(0, 117)}...` : preview;

  const fallbackColor = useMemo(() => {
    const index = info.fallbackLetter.charCodeAt(0) % FALLBACK_COLORS.length;
    return FALLBACK_COLORS[index];
  }, [info.fallbackLetter]);

  return (
    <TouchableOpacity
      onPress={() => onPress?.(conversation)}
      activeOpacity={0.7}
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#111' : '#fff' },
      ]}
    >
      {info.avatarUrl ? (
        <CachedImage source={{ uri: info.avatarUrl }} style={styles.avatar} cachePolicy="disk" />
      ) : (
        <View
          style={[
            styles.fallbackAvatar,
            { backgroundColor: fallbackColor },
          ]}
        >
          <Text style={styles.fallbackLetter}>{info.fallbackLetter}</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { color: isDarkMode ? '#fff' : '#111' },
            ]}
            numberOfLines={1}
          >
            {info.title}
          </Text>

          <Text
            style={[
              styles.timestamp,
              { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
            ]}
          >
            {formatTimestamp(conversation.last_message_at ?? undefined)}
          </Text>
        </View>

        {info.subtitle ? (
          <Text
            style={[
              styles.subtitle,
              { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
            ]}
            numberOfLines={1}
          >
            {info.subtitle}
          </Text>
        ) : null}

        {info.carInfo ? (
          <View style={styles.carBadge}>
            <Ionicons
              name={conversation.carRent ? 'car-outline' : 'checkmark-circle'}
              size={14}
              color={conversation.carRent ? '#D55004' : '#666'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.carInfo,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
              ]}
              numberOfLines={1}
            >
              {info.carInfo}
            </Text>
          </View>
        ) : null}

        {info.plateInfo ? (
          <View style={styles.carBadge}>
            <Ionicons
              name="id-card-outline"
              size={14}
              color="#D55004"
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.carInfo,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
              ]}
              numberOfLines={1}
            >
              {info.plateInfo}
            </Text>
          </View>
        ) : null}

        {info.conversationType === 'user_user' && viewerRole === 'user' ? (
          <View style={styles.carBadge}>
            <Ionicons
              name="person-outline"
              size={14}
              color="#2563EB"
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.carInfo,
                { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
              ]}
              numberOfLines={1}
            >
              {t('chat.private_seller', 'Private Seller')}
            </Text>
          </View>
        ) : null}

        <View style={styles.previewRow}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color={isDarkMode ? '#9CA3AF' : '#6B7280'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.preview,
              { color: isDarkMode ? '#D1D5DB' : '#4B5563' },
            ]}
            numberOfLines={2}
          >
            {previewDisplay}
          </Text>
        </View>
      </View>

      {unreadCount > 0 ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
  },
  fallbackAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  fallbackLetter: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  timestamp: {
    fontSize: 12,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  carBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  carInfo: {
    fontSize: 12,
    marginTop: 2,
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  preview: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  unreadBadge: {
    marginLeft: 12,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#D55004',
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});

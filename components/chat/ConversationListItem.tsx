import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
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

// Status badge colors (only show Inquiry, Sold, Deleted)
const STATUS_COLORS: Record<string, string> = {
  inquiry: '#D55004',
  sold: '#16A34A',
  deleted: '#EF4444',
};

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

function getStatusLabel(conversation: ConversationSummary): { label: string; color: string } {
  const carInfo = conversation.car || conversation.carRent;
  const plateInfo = conversation.numberPlate;

  // Default to Inquiry for active conversations
  if (carInfo) {
    const status = carInfo.status;
    if (status === 'sold') return { label: 'Sold', color: STATUS_COLORS.sold };
    if (status === 'deleted') return { label: 'Deleted', color: STATUS_COLORS.deleted };
    return { label: 'Inquiry', color: STATUS_COLORS.inquiry };
  }

  if (plateInfo) {
    const status = plateInfo.status;
    if (status === 'sold') return { label: 'Sold', color: STATUS_COLORS.sold };
    if (status === 'deleted') return { label: 'Deleted', color: STATUS_COLORS.deleted };
    return { label: 'Inquiry', color: STATUS_COLORS.inquiry };
  }

  return { label: 'Inquiry', color: STATUS_COLORS.inquiry };
}

function getProductImage(conversation: ConversationSummary): string | null {
  const carInfo = conversation.car || conversation.carRent;
  const plateInfo = conversation.numberPlate;

  if (carInfo?.images && carInfo.images.length > 0) {
    return carInfo.images[0];
  }

  if (plateInfo?.picture) {
    return plateInfo.picture;
  }

  return null;
}

function getDisplayInfo(
  conversation: ConversationSummary,
  viewerRole: 'user' | 'dealer',
  fetchedUserName?: string | null
) {
  const carInfo = conversation.car || conversation.carRent;
  const plateInfo = conversation.numberPlate;

  // Check if the listing is deleted
  const isDeleted = carInfo?.status === 'deleted' || plateInfo?.status === 'deleted';

  // Determine listing label
  let listingLabel = '';
  if (carInfo) {
    listingLabel = `${carInfo.make} ${carInfo.model} (${carInfo.year})${
      conversation.carRent ? ' • For Rent' : ''
    }${isDeleted ? ' • (Deleted)' : ''}`;
  } else if (plateInfo) {
    listingLabel = `Plate: ${plateInfo.letter} ${plateInfo.digits}${isDeleted ? ' • (Deleted)' : ''}`;
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
        isDeleted,
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
      isDeleted,
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
    isDeleted,
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

  const hasUnread = unreadCount > 0;

  const preview =
    conversation.last_message_preview ||
    t('chat.no_messages_yet', 'No messages yet');

  const previewDisplay =
    preview.length > 60 ? `${preview.slice(0, 57)}...` : preview;

  const fallbackColor = useMemo(() => {
    const index = info.fallbackLetter.charCodeAt(0) % FALLBACK_COLORS.length;
    return FALLBACK_COLORS[index];
  }, [info.fallbackLetter]);

  const productImage = getProductImage(conversation);
  const statusInfo = getStatusLabel(conversation);

  return (
    <TouchableOpacity
      onPress={() => onPress?.(conversation)}
      activeOpacity={0.7}
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? '#1A1A1A' : '#fff' },
        info.isDeleted && { opacity: 0.6 },
      ]}
    >
      {/* Product Image with Status Badge and Avatar */}
      <View style={styles.imageContainer}>
        {productImage ? (
          <CachedImage
            source={{ uri: productImage }}
            style={styles.productImage}
            cachePolicy="disk"
          />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
          <Text style={styles.statusText}>{statusInfo.label}</Text>
        </View>

        {/* Avatar overlapping bottom-left */}
        <View style={styles.avatarWrapper}>
          {info.avatarUrl ? (
            <CachedImage
              source={{ uri: info.avatarUrl }}
              style={styles.avatar}
              cachePolicy="disk"
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.fallbackAvatar,
                { backgroundColor: info.isDeleted ? '#666' : fallbackColor },
              ]}
            >
              <Text style={styles.fallbackLetter}>{info.fallbackLetter}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        {/* Header Row with Title and Timestamp */}
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

        {/* Preview Row with Unread Dot */}
        <View style={styles.previewRow}>
          <Text
            style={[
              styles.preview,
              { color: isDarkMode ? '#D1D5DB' : '#4B5563' },
            ]}
            numberOfLines={2}
          >
            {previewDisplay}
          </Text>
          {hasUnread && <View style={styles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    width: 100,
    height: 75,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  productImagePlaceholder: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  statusBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'capitalize',
  },
  avatarWrapper: {
    position: 'absolute',
    bottom: -8,
    left: -8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  fallbackAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackLetter: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  preview: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D55004',
    marginLeft: 8,
    marginTop: 4,
  },
});

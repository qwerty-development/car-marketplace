import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ChatMessage, ConversationOffer } from '@/types/chat';

interface OfferBubbleProps {
  message: ChatMessage;
  offer: ConversationOffer | null;
  /** Which side of the negotiation the viewer is on; null = spectator. */
  mySide: 'buyer' | 'seller' | null;
  isOwn: boolean;
  isDarkMode?: boolean;
  busy?: boolean;
  onAccept: (offer: ConversationOffer) => void;
  onDecline: (offer: ConversationOffer) => void;
  onCounter: (offer: ConversationOffer) => void;
}

const formatAmount = (value: number) =>
  `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Chat bubble for type='offer' messages (US-12/13). Shows the amount and
 * status; when the offer is pending and the viewer is on the opposite side,
 * renders one-tap Accept / Decline plus Counter.
 */
export default function OfferBubble({
  message,
  offer,
  mySide,
  isOwn,
  isDarkMode = false,
  busy = false,
  onAccept,
  onDecline,
  onCounter,
}: OfferBubbleProps) {
  const { t } = useTranslation();

  const status = offer?.status ?? null;
  const canRespond =
    !!offer && status === 'pending' && mySide !== null && offer.made_by_side !== mySide;

  const statusLabel = status
    ? t(`offers.statuses.${status}`)
    : null;
  const statusColor =
    status === 'accepted'
      ? '#22C55E'
      : status === 'declined'
      ? '#EF4444'
      : status === 'superseded'
      ? '#9CA3AF'
      : '#D55004';

  return (
    <View style={[styles.container, { justifyContent: isOwn ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isDarkMode ? '#1F1F1F' : '#FFFFFF',
            borderColor: statusColor,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Ionicons name="pricetags" size={16} color={statusColor} />
          <Text style={[styles.headerText, { color: statusColor }]}>
            {offer && offer.parent_offer_id
              ? t('offers.counterOffer')
              : t('offers.offer')}
          </Text>
          {statusLabel && (
            <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          )}
        </View>

        <Text
          style={[
            styles.amount,
            { color: isDarkMode ? '#FFFFFF' : '#111827' },
          ]}
        >
          {offer ? formatAmount(offer.amount) : message.body}
        </Text>

        {offer && (
          <Text style={[styles.listPrice, { color: isDarkMode ? '#737373' : '#9CA3AF' }]}>
            {t('offers.listedAt', { price: formatAmount(offer.listing_price_snapshot) })}
          </Text>
        )}

        {canRespond && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => offer && onAccept(offer)}
              disabled={busy}
              style={[styles.actionButton, { backgroundColor: '#22C55E', opacity: busy ? 0.6 : 1 }]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionText}>{t('offers.accept')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => offer && onDecline(offer)}
              disabled={busy}
              style={[styles.actionButton, { backgroundColor: '#EF4444', opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={styles.actionText}>{t('offers.decline')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => offer && onCounter(offer)}
              disabled={busy}
              style={[styles.actionButton, { backgroundColor: '#D55004', opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={styles.actionText}>{t('offers.counter')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.time, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  bubble: {
    maxWidth: '85%',
    minWidth: 200,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusChip: {
    marginLeft: 'auto',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  amount: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
  },
  listPrice: {
    fontSize: 11,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  time: {
    fontSize: 10,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
});

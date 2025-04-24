// app/(home)/(user)/notifications.tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Pressable,
  Platform,
  StyleSheet
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/utils/ThemeContext'
import { BlurView } from 'expo-blur'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import Animated, {
  FadeInDown,
  FadeOutUp,
  SlideInRight,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
  interpolateColor,
  FadeIn,
  Layout
} from 'react-native-reanimated'
import { GestureHandlerRootView, Swipeable, ScrollView } from 'react-native-gesture-handler'
import { FlashList } from '@shopify/flash-list'
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns'
import * as Haptics from 'expo-haptics'
import { useRouter, useNavigation } from 'expo-router'
import { useAuth } from '@/utils/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationService } from '@/services/NotificationService'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Notification {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  type?: string // Added type field for categorization
  data?: {
    screen?: string
    params?: Record<string, any>
  }
}

// Enhanced notification grouping and filtering
type NotificationGroup = {
  title: string;
  data: Notification[];
}

type FilterType = 'all' | 'unread' | 'read';
type SortType = 'newest' | 'oldest';

const ITEMS_PER_PAGE = 20
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// Notification type to icon/color mapping for visual categorization
const NOTIFICATION_TYPES: Record<string, { icon: string, color: string }> = {
  'car_like': { icon: 'heart', color: '#FF4D6D' },
  'price_drop': { icon: 'pricetag', color: '#4ECDC4' },
  'new_message': { icon: 'chatbubble', color: '#635EFD' },
  'subscription': { icon: 'calendar', color: '#FFD166' },
  'car_sold': { icon: 'car-sport', color: '#06D6A0' },
  'view_milestone': { icon: 'eye', color: '#118AB2' },
  'autoclip_like': { icon: 'videocam', color: '#EF476F' },
  'daily_reminder': { icon: 'alarm', color: '#073B4C' },
  'default': { icon: 'notifications', color: '#8A8A8A' }
};

// Animation constants for more consistent animations
const ANIMATION_CONFIG = {
  mass: 1,
  damping: 15,
  stiffness: 120,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01
};

export default function NotificationsScreen() {
  const { isDarkMode } = useTheme()
  const { user } = useAuth()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [sortType, setSortType] = useState<SortType>('newest')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const mounted = useRef(true)
  const scrollRef = useRef<ScrollView>(null)
  const [notificationsScreenKey, setNotificationsScreenKey] = useState(0)
  const filterMenuHeight = useSharedValue(0)
  const headerOpacity = useSharedValue(1)
  const fabScale = useSharedValue(1)

  // Animation styles
  const filterMenuStyle = useAnimatedStyle(() => ({
    height: filterMenuHeight.value,
    opacity: filterMenuHeight.value > 0 ? 1 : 0,
    overflow: 'hidden'
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value
  }));

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }]
  }));

  // Use the enhanced notification hook
  const {
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    unreadCount
  } = useNotifications()

  // Toggle filter menu with animation
  const toggleFilterMenu = useCallback(() => {
    if (showFilterMenu) {
      filterMenuHeight.value = withTiming(0, { duration: 300 });
      setTimeout(() => setShowFilterMenu(false), 300);
    } else {
      setShowFilterMenu(true);
      filterMenuHeight.value = withTiming(200, { duration: 300 });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [showFilterMenu, filterMenuHeight]);

  // Force remount on blur/focus
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setNotificationsScreenKey(prevKey => prevKey + 1)
      fabScale.value = withSpring(1, ANIMATION_CONFIG);
      // Refresh unread count when screen is focused
      onRefresh()
    })

    const unsubscribeBlur = navigation.addListener('blur', () => {
      setNotificationsScreenKey(0) // Reset key to unmount
      fabScale.value = withSpring(0, ANIMATION_CONFIG);
    })

    return () => {
      unsubscribeFocus()
      unsubscribeBlur()
    }
  }, [navigation, fabScale])

  // Extract all unique categories from notifications
  const categories = useMemo(() => {
    const uniqueTypes = Array.from(new Set(notifications.map(n => n.type || 'default')));
    return ['all', ...uniqueTypes];
  }, [notifications]);

  // Group notifications by date for better organization
  const groupedNotifications = useMemo(() => {
    const filtered = notifications.filter(notification => {
      // Apply filter based on read status
      if (filterType === 'read' && !notification.is_read) return false;
      if (filterType === 'unread' && notification.is_read) return false;

      // Apply category filter if selected
      if (selectedCategory && selectedCategory !== 'all' && notification.type !== selectedCategory) return false;

      // Apply search filter if in search mode
      if (isSearchMode && searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return (
          notification.title.toLowerCase().includes(query) ||
          notification.message.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Sort notifications based on sortType
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortType === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // Group by date
    const groups: NotificationGroup[] = [];
    sorted.forEach(notification => {
      const date = new Date(notification.created_at);
      let groupTitle: string;

      if (isToday(date)) {
        groupTitle = 'Today';
      } else if (isYesterday(date)) {
        groupTitle = 'Yesterday';
      } else if (isThisWeek(date)) {
        groupTitle = 'This Week';
      } else if (isThisMonth(date)) {
        groupTitle = 'This Month';
      } else {
        groupTitle = format(date, 'MMMM yyyy');
      }

      const existingGroup = groups.find(g => g.title === groupTitle);
      if (existingGroup) {
        existingGroup.data.push(notification);
      } else {
        groups.push({ title: groupTitle, data: [notification] });
      }
    });

    return groups;
  }, [notifications, filterType, selectedCategory, isSearchMode, searchQuery, sortType]);

  const fetchNotifications = useCallback(
    async (pageNum = 1, shouldRefresh = false) => {
      if (!user) return

      try {
        setError(null)
        if (shouldRefresh) {
          setRefreshing(true);
        }

        const { notifications: newNotifications, hasMore: more } =
          await NotificationService.fetchNotifications(user.id, {
            page: pageNum,
            limit: ITEMS_PER_PAGE
          })

        if (mounted.current) {
          setNotifications(prev =>
            shouldRefresh ? newNotifications : [...prev, ...newNotifications]
          )
          setHasMore(more)
          setPage(pageNum)
        }

        // Refresh unread count using the hook's method
        refreshNotifications()
      } catch (error) {
        console.error('Error fetching notifications:', error)
        if (mounted.current) {
          setError('Failed to load notifications')
        }
      } finally {
        if (mounted.current) {
          setRefreshing(false)
        }
      }
    },
    [user, refreshNotifications]
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchNotifications(1, true)
  }, [fetchNotifications])

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', async () => {
      setNotificationsScreenKey(prevKey => prevKey + 1);

      // Reset badge count to 0 when notifications screen is accessed
      if (user?.id) {
        try {
          // Reset system badge to 0
          await NotificationService.setBadgeCount(0);

          // Refresh notifications to update UI state
          onRefresh();
        } catch (error) {
          console.error('Error resetting badge count:', error);
        }
      }
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      setNotificationsScreenKey(0); // Reset key to unmount
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, user?.id, onRefresh]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications(1, true)
    return () => {
      mounted.current = false
    }
  }, [fetchNotifications])

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      fetchNotifications(page + 1)
    }
  }, [hasMore, loading, refreshing, page, fetchNotifications])

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      // Use the hook's markAsRead method instead
      await markAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      )
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [markAsRead])

  const handleMarkAllAsRead = useCallback(async () => {
    if (!user) return

    try {
      // Use the hook's markAllAsRead method instead
      await markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }, [user, markAllAsRead])

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedNotifications([]);

    // Collapse filter menu when toggling selection mode
    if (showFilterMenu) {
      toggleFilterMenu();
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [isSelectionMode, showFilterMenu, toggleFilterMenu]);

  // Handle notification selection
  const toggleNotificationSelection = useCallback((notificationId: string) => {
    setSelectedNotifications(prev => {
      if (prev.includes(notificationId)) {
        return prev.filter(id => id !== notificationId);
      } else {
        return [...prev, notificationId];
      }
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle bulk operations on selected notifications
  const handleBulkAction = useCallback(async (action: 'delete' | 'markAsRead') => {
    if (selectedNotifications.length === 0) return;

    try {
      if (action === 'delete') {
        // Delete all selected notifications
        await Promise.all(selectedNotifications.map(id => deleteNotification(id)));
        setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (action === 'markAsRead') {
        // Mark all selected notifications as read
        await Promise.all(selectedNotifications.map(id => markAsRead(id)));
        setNotifications(prev =>
          prev.map(n =>
            selectedNotifications.includes(n.id) ? { ...n, is_read: true } : n
          )
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Exit selection mode after action
      setIsSelectionMode(false);
      setSelectedNotifications([]);
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
    }
  }, [selectedNotifications, deleteNotification, markAsRead]);

  const handleDelete = useCallback(async (notificationId: string) => {
    try {
      // Use the hook's deleteNotification method instead
      await deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [deleteNotification])

  const handleClearAll = useCallback(async () => {
    if (!user || notifications.length === 0) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Show confirmation modal or alert here if needed

      // Delete all notifications (could be optimized with a bulk delete API)
      await Promise.all(notifications.map(n => deleteNotification(n.id)));
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  }, [user, notifications, deleteNotification]);

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      // If in selection mode, toggle selection instead of navigating
      if (isSelectionMode) {
        toggleNotificationSelection(notification.id);
        return;
      }

      // Mark as read
      if (!notification.is_read) {
        handleMarkAsRead(notification.id)
      }

      // Navigate if there's a destination
      if (notification.data?.screen) {
        router.replace({
          pathname: notification.data.screen as any,
          params: notification.data.params
        })
      }
    },
    [handleMarkAsRead, router, isSelectionMode, toggleNotificationSelection]
  )

  // Get notification icon based on type
  const getNotificationTypeInfo = useCallback((type?: string) => {
    return NOTIFICATION_TYPES[type || 'default'] || NOTIFICATION_TYPES.default;
  }, []);

  // Update filter type
  const setFilter = useCallback((type: FilterType) => {
    setFilterType(type);
    toggleFilterMenu();
  }, [toggleFilterMenu]);

  // Update sort type
  const setSort = useCallback((type: SortType) => {
    setSortType(type);
    toggleFilterMenu();
  }, [toggleFilterMenu]);

  // Update category filter
  const setCategory = useCallback((category: string | null) => {
    setSelectedCategory(category === 'all' ? null : category);
    toggleFilterMenu();
  }, [toggleFilterMenu]);

  const renderNotification = useCallback(
    ({ item: notification }: { item: Notification }) => {
      const isSelected = selectedNotifications.includes(notification.id);
      const typeInfo = getNotificationTypeInfo(notification.type);
  
      return (
        <Animated.View
          key={notification.id}
          entering={FadeInDown.delay(100).springify()}
          layout={Layout.springify()}
          className='mx-4 rounded-3xl mb-4'>
          <TouchableOpacity
          
            onPress={() => handleNotificationPress(notification)}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (!isSelectionMode) {
                toggleSelectionMode();
                toggleNotificationSelection(notification.id);
              }
            }}
            delayLongPress={300}
            className='overflow-hidden rounded-3xl '>
            <BlurView
              intensity={isDarkMode ? 40 : 60}
              tint={isDarkMode ? 'dark' : 'light'}
              className={`p-4 rounded-3xl ${
                isSelected ? 'border-2 border-red' :
                !notification.is_read ? 'border-l-4 border-red' : ''
              }`}>
              <View className='flex-row items-start'>
                <View
                  className='mr-3 mt-1 w-8 h-8 rounded-full justify-center items-center'
                  style={{ backgroundColor: `${typeInfo.color}20` }}>
                  <Ionicons
                    name={typeInfo.icon as any}
                    size={16}
                    color={typeInfo.color}
                  />
                </View>
  
                <View className='flex-1 mr-2'>
                  <Text
                    numberOfLines={2}
                    className={`font-semibold text-base mb-1 ${
                      isDarkMode ? 'text-white' : 'text-black'
                    }`}>
                    {notification.title}
                  </Text>
                  <Text
                    numberOfLines={3}
                    className={`${isDarkMode ? 'text-neutral-200' : 'text-neutral-600'}`}>
                    {notification.message}
                  </Text>
                  <Text
                    className={`text-xs mt-2 ${
                      isDarkMode ? 'text-neutral-300' : 'text-neutral-600'
                    }`}>
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true
                    })}
                  </Text>
                </View>
  
                <View className='flex-row items-center'>
                  {isSelectionMode ? (
                    <View className={`w-6 h-6 rounded-full border-2 justify-center items-center ${
                      isSelected ? 'bg-red border-red' : isDarkMode ? 'border-white' : 'border-neutral-400'
                    }`}>
                      {isSelected && (
                        <Ionicons name='checkmark' size={16} color='white' />
                      )}
                    </View>
                  ) : (
                    !notification.is_read && (
                      <View className='w-3 h-3 rounded-full bg-red' />
                    )
                  )}
                </View>
              </View>
            </BlurView>
          </TouchableOpacity>
        </Animated.View>
      )
    },
    [
      isDarkMode,
      handleNotificationPress,
      isSelectionMode,
      selectedNotifications,
      toggleNotificationSelection,
      toggleSelectionMode,
      getNotificationTypeInfo
    ]
  )
  const renderSectionHeader = useCallback(({ title }: { title: string }) => {
    return (
      <Animated.View
        entering={FadeIn.delay(200)}
        className='mx-4 mt-8 mb-3'> {/* Increased top margin */}
        <Text
          className={`text-sm font-medium uppercase tracking-wider ${
            isDarkMode ? 'text-neutral-300' : 'text-neutral-600'
          }`}> 
          {title}
        </Text>
      </Animated.View>
    );
  }, [isDarkMode]);

  const renderHeader = useCallback(() => {
    const hasUnread = notifications.some(n => !n.is_read);
    
    return (
      <View className="flex-row justify-between items-center px-4 py-3">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="p-2">
          <Ionicons
            name="chevron-down"
            size={24}
            color={isDarkMode ? 'white' : 'black'}
          />
        </TouchableOpacity>
        
        {hasUnread && !isSelectionMode && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            className='flex-row items-center bg-red/10 px-4 py-2 rounded-full'>
            <Ionicons name='checkmark-done-outline' size={18} color='#D55004' />
            <Text className='text-red ml-2 font-medium'>Read all</Text>
          </TouchableOpacity>
        )}
        
        {isSelectionMode ? (
          <TouchableOpacity onPress={toggleSelectionMode}>
            <Ionicons name="close" size={24} color={isDarkMode ? 'white' : 'black'} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={toggleFilterMenu}>
            <Ionicons 
              name="filter" 
              size={24} 
              color={filterType !== 'all' || selectedCategory || sortType !== 'newest' 
                ? '#D55004' 
                : isDarkMode ? 'white' : 'black'} 
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [isDarkMode, notifications, isSelectionMode, handleMarkAllAsRead, toggleSelectionMode, toggleFilterMenu, filterType, selectedCategory, sortType]);

// Add this to the renderMinimalHeader function
const renderMinimalHeader = useCallback(() => {
  return (
    <View className="items-center">
      {/* Pull down indicator */}
      <View className="w-12 h-1 bg-neutral-400/30 rounded-full my-2" />
      
      <View className="flex-row justify-end items-center w-full px-4 py-2">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="p-2 rounded-full bg-neutral-200/30">
          <Ionicons
            name="chevron-down"
            size={24}
            color={isDarkMode ? 'white' : 'black'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}, [isDarkMode, router]);

  const renderNotificationGroup = useCallback((group: NotificationGroup, index: number) => {
    return (
      <View key={group.title}>
        {renderSectionHeader({ title: group.title })}
        {group.data.map(notification => renderNotification({ item: notification }))}
      </View>
    );
  }, [renderSectionHeader, renderNotification]);

  const FilterMenu = useCallback(() => {
    if (!showFilterMenu) return null;

    return (
      <Animated.View
        style={[filterMenuStyle]}
        className={`mx-4 rounded-xl overflow-hidden ${isDarkMode ? 'bg-neutral-800' : 'bg-white'}`}>
        <ScrollView className='p-4'>
          <Text className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            Filter by
          </Text>

          <View className='flex-row flex-wrap mb-4'>
            <TouchableOpacity
              onPress={() => setFilter('all')}
              className={`mr-2 mb-2 px-3 py-1 rounded-full ${
                filterType === 'all' ? 'bg-red' : isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'
              }`}>
              <Text className={filterType === 'all' ? 'text-white' : isDarkMode ? 'text-neutral-200' : 'text-neutral-600'}>
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter('unread')}
              className={`mr-2 mb-2 px-3 py-1 rounded-full ${
                filterType === 'unread' ? 'bg-red' : isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'
              }`}>
              <Text className={filterType === 'unread' ? 'text-white' : isDarkMode ? 'text-neutral-200' : 'text-neutral-600'}>
                Unread
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilter('read')}
              className={`mr-2 mb-2 px-3 py-1 rounded-full ${
                filterType === 'read' ? 'bg-red' : isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'
              }`}>
              <Text className={filterType === 'read' ? 'text-white' : isDarkMode ? 'text-neutral-200' : 'text-neutral-600'}>
                Read
              </Text>
            </TouchableOpacity>
          </View>

          <Text className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            Sort by
          </Text>

          <View className='flex-row mb-4'>
            <TouchableOpacity
              onPress={() => setSort('newest')}
              className={`mr-2 px-3 py-1 rounded-full ${
                sortType === 'newest' ? 'bg-red' : isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'
              }`}>
              <Text className={sortType === 'newest' ? 'text-white' : isDarkMode ? 'text-neutral-200' : 'text-neutral-600'}>
                Newest first
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSort('oldest')}
              className={`mr-2 px-3 py-1 rounded-full ${
                sortType === 'oldest' ? 'bg-red' : isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'
              }`}>
              <Text className={sortType === 'oldest' ? 'text-white' : isDarkMode ? 'text-neutral-200' : 'text-neutral-600'}>
                Oldest first
              </Text>
            </TouchableOpacity>
          </View>

          {categories.length > 1 && (
            <>
              <Text className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Categories
              </Text>

              <View className='flex-row flex-wrap'>
                {categories.map(category => (
                  <TouchableOpacity
                    key={category}
                    onPress={() => setCategory(category === 'all' ? null : category)}
                    className={`mr-2 mb-2 px-3 py-1 rounded-full flex-row items-center ${
                      (category === 'all' && !selectedCategory) || category === selectedCategory
                        ? 'bg-red'
                        : isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'
                    }`}>
                    {category !== 'all' && (
                      <Ionicons
                        name={(NOTIFICATION_TYPES[category] || NOTIFICATION_TYPES.default).icon as any}
                        size={14}
                        color={
                          (category === 'all' && !selectedCategory) || category === selectedCategory
                            ? 'white'
                            : isDarkMode ? 'text-neutral-100' : 'text-black'
                        }
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text
                      className={
                        (category === 'all' && !selectedCategory) || category === selectedCategory
                          ? 'text-white'
                          : isDarkMode ? 'text-neutral-400' : 'text-black'
                      }>
                      {category === 'all' ? 'All categories' : category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    );
  }, [
    showFilterMenu,
    isDarkMode,
    filterMenuStyle,
    filterType,
    sortType,
    categories,
    selectedCategory,
    setFilter,
    setSort,
    setCategory
  ]);

  const CountBadge = useCallback(({ count }: { count: number }) => {
    if (count === 0) return null;

    return (
      <Animated.View
        entering={ZoomIn}
        exiting={ZoomOut}
        className='absolute -top-2 -right-2 bg-red rounded-full min-w-5 h-5 justify-center items-center px-1'>
        <Text className='text-white text-xs font-bold'>
          {count > 99 ? '99+' : count}
        </Text>
      </Animated.View>
    );
  }, []);

  const ListHeader = useCallback(() => {
    return (
      <View className="pt-2">
        <FilterMenu />
  

        {(filterType !== 'all' || selectedCategory || sortType !== 'newest') && (
          <View className='flex-row flex-wrap px-4 py-2'>
    
            {filterType !== 'all' && (
              <View className='bg-red/20 rounded-full px-3 py-1 mr-2 mb-1 flex-row items-center'>
                <Ionicons name={filterType === 'unread' ? 'radio-button-off' : 'checkmark-circle'} size={14} color="#D55004" />
                <Text className='text-red text-xs ml-1 font-medium'>
                  {filterType === 'unread' ? 'Unread only' : 'Read only'}
                </Text>
              </View>
            )}
  
        
            {selectedCategory && (
              <View className='bg-red/20 rounded-full px-3 py-1 mr-2 mb-1 flex-row items-center'>
                <Ionicons
                  name={(NOTIFICATION_TYPES[selectedCategory] || NOTIFICATION_TYPES.default).icon as any}
                  size={14}
                  color="#D55004"
                />
                <Text className='text-red text-xs ml-1 font-medium'>
                  {selectedCategory}
                </Text>
              </View>
            )}
  
            {sortType !== 'newest' && (
              <View className='bg-red/20 rounded-full px-3 py-1 mr-2 mb-1 flex-row items-center'>
                <Ionicons name='arrow-up' size={14} color="#D55004" />
                <Text className='text-red text-xs ml-1 font-medium'>
                  Oldest first
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    )
  }, [
    filterType,
    selectedCategory,
    sortType,
    FilterMenu
  ])

  const ListEmptyComponent = useCallback(() => {
    if (error) {
      return (
        <View className='flex-1 justify-center items-center py-20'>
          <Ionicons
            name='alert-circle-outline'
            size={48}
            color={isDarkMode ? '#666' : '#999'}
          />
          <Text
            className={`mt-4 text-lg ${
              isDarkMode ? 'text-neutral-300' : 'text-neutral-600'
            }`}>
            {error}
          </Text>
          <TouchableOpacity
            className='mt-4 bg-red px-4 py-2 rounded-full'
            onPress={() => fetchNotifications(1, true)}>
            <Text className='text-white'>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }


    if (notifications.length > 0 && groupedNotifications.length === 0) {
      return (
        <View className='flex-1 justify-center items-center py-20'>
          <Ionicons
            name='filter-outline'
            size={48}
            color={isDarkMode ? '#666' : '#999'}
          />
          <Text
            className={`mt-4 text-center px-8 ${
              isDarkMode ? 'text-neutral-300' : 'text-neutral-600'
            }`}>
            No notifications match your current filters
          </Text>
          <TouchableOpacity
            className='mt-4 bg-red px-4 py-2 rounded-full'
            onPress={() => {
              setFilterType('all');
              setSelectedCategory(null);
              setSortType('newest');
              if (showFilterMenu) {
                toggleFilterMenu();
              }
            }}>
            <Text className='text-white'>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (loading && notifications.length === 0) {
      return null
    }

    return (
      <Animated.View
        entering={FadeIn.delay(300)}
        className='flex-1 justify-center items-center py-20'>
        <View className='w-24 h-24 rounded-full bg-neutral-100 justify-center items-center mb-4'>
          <Ionicons
            name='notifications-off-outline'
            size={48}
            color={isDarkMode ? '#666' : '#999'}
          />
        </View>
        <Text
          className={`text-lg mb-2 font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}>
          No notifications yet
        </Text>
        <Text
          className={`text-center px-12 ${
            isDarkMode ? 'text-neutral-300' : 'text-neutral-600'
          }`}>
          We'll notify you when there's activity related to your favorite cars and dealerships
        </Text>
      </Animated.View>
    )
  }, [
    isDarkMode,
    loading,
    error,
    notifications.length,
    fetchNotifications,
    groupedNotifications.length,
    toggleFilterMenu,
    showFilterMenu
  ])

  const showLoading = loading && notifications.length === 0;



  // FAB for clearing all notifications
  const renderFAB = useCallback(() => {

  
    return (
      <Animated.View
        style={[
          fabStyle,
          {
            position: 'absolute',
            bottom: Math.max(20, insets.bottom + 32),
            right: 16,
          }
        ]}
        entering={FadeIn.delay(500).springify()}>
        <TouchableOpacity
          onPress={handleClearAll}
          className='bg-red w-12 h-12 rounded-full justify-center items-center shadow-lg'
          style={Platform.OS === 'ios' ? styles.iosShadow : styles.androidShadow}>
          <Ionicons name="trash-outline" size={24} color="white" />
        </TouchableOpacity>
      </Animated.View>
    );
  }, [notifications.length, isSelectionMode, fabStyle, insets.bottom, handleClearAll]);

  const renderSelectionModeHeader = useCallback(() => {
    return (
      <Animated.View
        entering={FadeInDown}
        className='flex-row justify-between items-center px-4 py-3'>
        <TouchableOpacity onPress={toggleSelectionMode}>
          <Ionicons
            name='close'
            size={24}
            color={isDarkMode ? 'white' : 'black'}
          />
        </TouchableOpacity>
        
        <Text
          className={`text-base font-semibold ${
            isDarkMode ? 'text-white' : 'text-black'
          }`}>
          {selectedNotifications.length} selected
        </Text>
        
        <View className='flex-row'>
          {selectedNotifications.length > 0 && (
            <>
              <TouchableOpacity
                onPress={() => handleBulkAction('markAsRead')}
                className='mr-4'>
                <Ionicons
                  name='checkmark-done'
                  size={24}
                  color={isDarkMode ? 'white' : 'black'}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleBulkAction('delete')}>
                <Ionicons
                  name='trash'
                  size={24}
                  color={isDarkMode ? 'white' : 'black'}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    );
  }, [isDarkMode, toggleSelectionMode, selectedNotifications.length, handleBulkAction]);

  // This allows us to render a custom list with sections
  const renderContent = useCallback(() => {
    return (
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 10, // Add padding to the top
          paddingBottom: insets.bottom + 60 // Extra padding for FAB
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? '#fff' : '#000'}
          />
        }>
        <ListHeader />
        {groupedNotifications.length > 0 ? (
          groupedNotifications.map((group, index) =>
            renderNotificationGroup(group, index)
          )
        ) : (
          <ListEmptyComponent />
        )}
  
        {/* Load more indicator */}
        {hasMore && notifications.length > 0 && (
          <View className='py-6 items-center'>
            <ActivityIndicator color='#D55004' />
            <Text className={`mt-2 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
              Loading more...
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }, [
    insets.bottom,
    refreshing,
    onRefresh,
    isDarkMode,
    groupedNotifications,
    renderNotificationGroup,
    ListHeader,
    ListEmptyComponent,
    hasMore,
    notifications.length
  ]);

  return (
    <GestureHandlerRootView key={notificationsScreenKey} className='flex-1'>
      <SafeAreaView
        className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
        edges={['top']}>
        {isSelectionMode ? renderSelectionModeHeader() : renderHeader()}
        {renderContent()}
        {renderFAB()}
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  iosShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  androidShadow: {
    elevation: 6,
  }
});
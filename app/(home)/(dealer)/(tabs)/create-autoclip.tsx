import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
  StyleSheet,
  ScrollView
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { Video } from 'expo-av'
import { Image } from 'expo-image'
import CreateAutoClipModal from '@/components/CreateAutoClipModal'
import PreviewAutoClipModal from '@/components/PreviewAutoClipModal'
import { BlurView } from 'expo-blur'
import EditAutoClipModal from '@/components/EditAutoClipModal'
import { useScrollToTop } from '@react-navigation/native'
import { useAuth } from '@/utils/AuthContext'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const VIDEO_WIDTH = (SCREEN_WIDTH - 32) / 2
const VIDEO_HEIGHT = VIDEO_WIDTH * 1.5
const ITEMS_PER_PAGE = 4

// ENHANCED: AutoClip interface with new status fields
interface AutoClip {
  id: number
  dealership_id: number
  car_id: number
  title: string
  description: string
  video_url: string
  thumbnail_url: string
  views: number
  likes: number
  status: 'under_review' | 'published' | 'rejected' | 'archived'
  created_at: string
  submitted_at?: string
  reviewed_at?: string
  reviewed_by?: string
  rejection_reason?: string
  review_notes?: string
  car: {
    make: string
    model: string
    year: number
  }
}

interface Dealership {
  id: number
  name: string
  logo: string
  location: string
  phone: string
  user_id: string
}

const CustomHeader = React.memo(({ title, dealership }) => {
  const { isDarkMode } = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: isDarkMode ? 'black' : 'white',
      paddingBottom: Platform.OS === 'ios' ? 0 : 8,
      zIndex: 10,
    },
    titleContainer: {
      marginLeft: 16,
      marginBottom: Platform.OS === 'ios' ? -14 : 0,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDarkMode ? 'white' : 'black',
    },
    dealershipContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Platform.OS === 'ios' ? 12 : 8,
    },
    dealershipLogo: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginRight: 8,
    },
    dealershipName: {
      fontSize: 14,
      color: isDarkMode ? '#a1a1aa' : '#52525b',
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>

        {dealership && (
          <View style={styles.dealershipContainer}>
            {dealership.logo && (
              <Image
                source={{ uri: dealership.logo }}
                style={styles.dealershipLogo}
              />
            )}
            <Text style={styles.dealershipName}>
              {dealership.name}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
});

// ENHANCED: Status Badge Component
const StatusBadge = React.memo(({ status, isDarkMode }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'published':
        return {
          color: 'bg-emerald-500/80',
          text: 'Published',
          icon: 'checkmark-circle'
        }
      case 'under_review':
        return {
          color: 'bg-yellow-500/80',
          text: 'Under Review',
          icon: 'time'
        }
      case 'rejected':
        return {
          color: 'bg-red-500/80',
          text: 'Rejected',
          icon: 'close-circle'
        }
      case 'archived':
        return {
          color: 'bg-zinc-500/80',
          text: 'Archived',
          icon: 'document'
        }
      default:
        return {
          color: 'bg-zinc-500/80',
          text: status,
          icon: 'document'
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <View className={`px-2 py-1 rounded-full ${config.color} flex-row items-center`}>
      <Ionicons name={config.icon} size={10} color="white" style={{ marginRight: 4 }} />
      <Text className='text-white text-xs font-medium'>
        {config.text}
      </Text>
    </View>
  )
})

// ENHANCED: VideoItem component with status-aware actions
const VideoItem = React.memo(({
  item,
  onPress,
  isDarkMode,
  onDelete,
  onToggleStatus,
  onEdit
}: {
  item: AutoClip
  onPress: () => void
  isDarkMode: boolean
  onDelete: (id: number) => void
  onToggleStatus: (clip: AutoClip) => void
  onEdit: (clip: AutoClip) => void
}) => {
  
  // RULE: Determine available actions based on status
  const getAvailableActions = (status: string) => {
    switch (status) {
   
      case 'under_review':
        return [
          { text: 'View Details', action: () => onPress() },
          { text: 'Cancel Review', action: () => onToggleStatus(item) }
        ]
      case 'published':
        return [
          { text: 'Edit', action: () => onEdit(item) },
          { text: 'Unpublish', action: () => onToggleStatus(item) },
          { text: 'Delete', action: () => onDelete(item.id), style: 'destructive' }
        ]
      case 'rejected':
        return [
          { text: 'View Rejection Details', action: () => onPress() },
          { text: 'Delete', action: () => onDelete(item.id), style: 'destructive' }
        ]
      default:
        return []
    }
  }

  const handleActionsPress = (e) => {
    e.stopPropagation()
    const actions = getAvailableActions(item.status)
    
    if (actions.length === 0) return

    const alertOptions = [
      ...actions.map(action => ({
        text: action.text,
        style: action.style || 'default',
        onPress: action.action
      })),
      { text: 'Cancel', style: 'cancel' }
    ]

    Alert.alert('Manage AutoClip', 'Choose an action', alertOptions)
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      className='relative mb-4 mx-1'
      style={{ width: VIDEO_WIDTH }}
      activeOpacity={0.9}>
      <View className='rounded-2xl overflow-hidden shadow-lg'>
        <Image
          source={{ uri: item.thumbnail_url || item.video_url }}
          style={{
            width: VIDEO_WIDTH,
            height: VIDEO_HEIGHT
          }}
          contentFit="cover"
        />


        {item.status !== 'published' && (
          <View className='absolute top-0 left-0 right-0 p-2'>
            <StatusBadge status={item.status} isDarkMode={isDarkMode} />
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          className='absolute bottom-0 left-0 right-0 h-24 rounded-b-2xl'
        />

        <View className='absolute inset-x-3 bottom-3'>
          <Text className='text-white text-sm font-medium mb-1' numberOfLines={2}>
            {item.car.year} {item.car.make} {item.car.model}
          </Text>

          <View className='flex-row justify-between items-center'>
            <View className='flex-row items-center space-x-3'>
              <View className='flex-row items-center'>
                <FontAwesome name='eye' size={12} color='white' />
                <Text className='text-white text-xs ml-1'>{item.views}</Text>
              </View>
              <View className='flex-row items-center'>
                <FontAwesome name='heart' size={12} color='white' />
                <Text className='text-white text-xs ml-1'>{item.likes}</Text>
              </View>
            </View>

            {/* ENHANCED: Status badge in bottom corner */}
            <StatusBadge status={item.status} isDarkMode={isDarkMode} />
          </View>
        </View>

        {/* Actions button - only show if actions are available */}
        {getAvailableActions(item.status).length > 0 && (
          <View className='absolute top-3 right-3 rounded-full'>
            <TouchableOpacity
              className='p-2'
              onPress={handleActionsPress}>
              <Ionicons name='ellipsis-vertical' size={20} color='white' />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
});

// ENHANCED: EmptyState with status-specific messaging
const EmptyState = React.memo(({ isDarkMode, statusFilter }) => {
  const getEmptyMessage = (filter: string) => {
    switch (filter) {
      case 'under_review':
        return 'No clips under review'
      case 'rejected':
        return 'No rejected clips'
      case 'published':
        return 'No published clips'
      default:
        return 'No AutoClips Yet'
    }
  }

  const getEmptySubtitle = (filter: string) => {
    switch (filter) {
      case 'under_review':
        return 'Clips submitted for review will appear here'
      case 'rejected':
        return 'Rejected clips will appear here'
      case 'published':
        return 'Your approved and published clips will appear here'
      default:
        return 'Create your first AutoClip by tapping the + button below'
    }
  }

  return (
    <View className='flex-1 justify-center items-center p-8'>
      <View className='bg-neutral-100 dark:bg-neutral-800 rounded-full p-6 mb-4'>
        <Ionicons
          name='videocam'
          size={48}
          color={isDarkMode ? '#D55004' : '#D55004'}
        />
      </View>
      <Text className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
        {getEmptyMessage(statusFilter)}
      </Text>
      <Text className={`text-center ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
        {getEmptySubtitle(statusFilter)}
      </Text>
    </View>
  )
});

// FIXED: Status Filter Component with proper styling
const StatusFilter = React.memo(({ 
  activeFilter, 
  onFilterChange, 
  isDarkMode, 
  statusCounts 
}: {
  activeFilter: string
  onFilterChange: (filter: string) => void
  isDarkMode: boolean
  statusCounts: any
}) => {
  const filters = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'published', label: 'Published', count: statusCounts.published },
    { key: 'under_review', label: 'Review', count: statusCounts.under_review },
    { key: 'rejected', label: 'Rejected', count: statusCounts.rejected },
    { key: 'archived', label: 'Archived', count: statusCounts.archived }
  ]

  return (
    <View style={styles.filterContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
        style={styles.filterScrollView}>
        {filters.map((filter, index) => {
          const isActive = activeFilter === filter.key
          const hasCount = filter.count > 0
          
          return (
            <TouchableOpacity
              key={filter.key}
              onPress={() => onFilterChange(filter.key)}
              style={[
                styles.filterButton,
                {
                  backgroundColor: isActive 
                    ? '#D55004' 
                    : isDarkMode 
                      ? 'rgba(255, 255, 255, 0.1)' 
                      : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isActive 
                    ? '#D55004' 
                    : isDarkMode 
                      ? 'rgba(255, 255, 255, 0.2)' 
                      : 'rgba(0, 0, 0, 0.1)',
                  marginRight: index === filters.length - 1 ? 16 : 8,
                }
              ]}
              activeOpacity={0.7}>
              <View style={styles.filterButtonContent}>
                <Text
                  style={[
                    styles.filterButtonText,
                    {
                      color: isActive 
                        ? '#FFFFFF' 
                        : isDarkMode 
                          ? '#E5E5E5' 
                          : '#374151',
                    }
                  ]}>
                  {filter.label}
                </Text>
                {hasCount && (
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: isActive 
                          ? 'rgba(255, 255, 255, 0.25)' 
                          : '#D55004',
                      }
                    ]}>
                    <Text
                      style={[
                        styles.countBadgeText,
                        {
                          color: '#FFFFFF'
                        }
                      ]}>
                      {filter.count}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  // Filter Container Styles
  filterContainer: {
    paddingVertical: 25,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterScrollView: {
    paddingHorizontal: 16,
  },
  filterScrollContent: {
    alignItems: 'center',
    paddingRight: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
})

const PaginationControls = React.memo(({ currentPage, totalPages, onPageChange, isDarkMode, isPageLoading }) => {
  const paginationStyles = StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 70,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 8,
      zIndex: 999,
    },
    button: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(39, 39, 42, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 4,
    },
    disabledButton: {
      opacity: 0.3,
    },
    paginationInfo: {
      backgroundColor: 'rgba(39, 39, 42, 0.8)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginHorizontal: 4,
      flexDirection: 'row',
      alignItems: 'center',
    },
    paginationText: {
      color: 'white',
      fontWeight: '600',
      fontSize: 14,
    },
  });

  return (
    <View style={paginationStyles.container}>
      <TouchableOpacity
        style={[paginationStyles.button, (currentPage === 1 || isPageLoading) && paginationStyles.disabledButton]}
        onPress={() => !isPageLoading && onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || isPageLoading}>
        <Ionicons name="chevron-back" size={20} color="white" />
      </TouchableOpacity>

      <View style={paginationStyles.paginationInfo}>
        {isPageLoading ? (
          <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
        ) : null}
        <Text style={paginationStyles.paginationText}>
          {currentPage} / {totalPages || 1}
        </Text>
      </View>

      <TouchableOpacity
        style={[paginationStyles.button, (currentPage === totalPages || isPageLoading) && paginationStyles.disabledButton]}
        onPress={() => !isPageLoading && onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || isPageLoading}>
        <Ionicons name="chevron-forward" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );
});

export default function AutoClips() {
  const { user } = useAuth()
  const { isDarkMode } = useTheme()
  const scrollRef = useRef(null)
  useScrollToTop(scrollRef)

  const [clips, setClips] = useState<AutoClip[]>([])
  const [dealershipData, setDealershipData] = useState<Dealership | null>(null)
  const [loading, setLoading] = useState(true)
  const [dealership, setDealership] = useState<{ id: number } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [selectedClip, setSelectedClip] = useState<AutoClip | null>(null)
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [clipToEdit, setClipToEdit] = useState<AutoClip | null>(null)

  // NEW: Status filtering
  const [statusFilter, setStatusFilter] = useState('all')
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    published: 0,
    under_review: 0,
    rejected: 0,
    archived:0
  })

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Cache for loaded pages
  const [cachedPages, setCachedPages] = useState<{[key: string]: AutoClip[]}>({})

  // Track if dealership data has been loaded
  const [dealershipLoaded, setDealershipLoaded] = useState(false)

  // Separate fetch for dealership data
  const fetchDealershipData = useCallback(async () => {
    if (dealershipLoaded) return { success: true, dealershipId: dealership?.id }

    try {
      const { data, error } = await supabase
        .from('dealerships')
        .select('*')
        .eq('user_id', user!.id)
        .single()

      if (error) throw error

      setDealershipData(data)
      setDealership({ id: data.id })
      setDealershipLoaded(true)

      return { success: true, dealershipId: data.id }
    } catch (error) {
      console.error('Error fetching dealership:', error)
      Alert.alert('Error', 'Failed to load dealership data')
      return { success: false, dealershipId: null }
    }
  }, [user, dealershipLoaded, dealership?.id])

  // NEW: Fetch status counts
  const fetchStatusCounts = useCallback(async (dealershipId: number) => {
    try {
      const { data, error } = await supabase
        .from('auto_clips')
        .select('status')
        .eq('dealership_id', dealershipId)

      if (error) throw error

      const counts = {
        all: data?.length || 0,
        published: data?.filter(clip => clip.status === 'published').length || 0,
        under_review: data?.filter(clip => clip.status === 'under_review').length || 0,
        rejected: data?.filter(clip => clip.status === 'rejected').length || 0,
        archived: data?.filter(clip => clip.status === 'archived').length || 0
      }

      setStatusCounts(counts)
      return { success: true, counts }
    } catch (error) {
      console.error('Error fetching status counts:', error)
      return { success: false, counts: statusCounts }
    }
  }, [])

  // ENHANCED: Fetch total count with status filter
  const fetchTotalCount = useCallback(async (dealershipId: number, filter: string = 'all') => {
    try {
      let query = supabase
        .from('auto_clips')
        .select('id', { count: 'exact' })
        .eq('dealership_id', dealershipId)

      // Apply status filter
      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { count, error } = await query

      if (error) throw error

      const pages = Math.ceil((count || 0) / ITEMS_PER_PAGE)
      setTotalPages(pages || 1)
      return { success: true, totalPages: pages || 1 }
    } catch (error) {
      console.error('Error fetching count:', error)
      return { success: false, totalPages: 1 }
    }
  }, [])

  // ENHANCED: Fetch clips with status filter
  const fetchPageClips = useCallback(async (dealershipId: number, page: number, filter: string = 'all') => {
    // Create cache key with filter
    const cacheKey = `${filter}_${page}`
    
    // Check if page is already cached
    if (cachedPages[cacheKey] && !refreshing) {
      setClips(cachedPages[cacheKey])
      return { success: true }
    }

    setIsPageLoading(true)

    try {
      let query = supabase
        .from('auto_clips')
        .select(`
          *,
          car:cars(make, model, year)
        `)
        .eq('dealership_id', dealershipId)

      // Apply status filter
      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

      if (error) throw error

      // Update cache and current clips
      setCachedPages(prev => ({ ...prev, [cacheKey]: data }))
      setClips(data)

      return { success: true }
    } catch (error) {
      console.error('Error fetching clips:', error)
      return { success: false }
    } finally {
      setIsPageLoading(false)
    }
  }, [cachedPages, refreshing])

  // Initialize data on component mount
  useEffect(() => {
    if (user) {
      const initializeData = async () => {
        setLoading(true)

        // Step 1: Get dealership data
        const dealershipResult = await fetchDealershipData()
        if (!dealershipResult.success) {
          setLoading(false)
          return
        }

        // Step 2: Get status counts
        await fetchStatusCounts(dealershipResult.dealershipId)

        // Step 3: Get total count
        const countResult = await fetchTotalCount(dealershipResult.dealershipId, statusFilter)
        if (!countResult.success) {
          setLoading(false)
          return
        }

        // Step 4: Get clips for first page
        await fetchPageClips(dealershipResult.dealershipId, 1, statusFilter)

        setLoading(false)
      }

      initializeData()
    }
  }, [user, fetchDealershipData, fetchStatusCounts, fetchTotalCount, fetchPageClips, statusFilter])

  // Handle page changes with filter
  useEffect(() => {
    const loadPage = async () => {
      if (dealership?.id) {
        await fetchPageClips(dealership.id, currentPage, statusFilter)
      }
    }

    if (!loading && dealership?.id) {
      loadPage()
    }
  }, [currentPage, dealership?.id, loading, fetchPageClips, statusFilter])

  // NEW: Handle status filter change
  const handleStatusFilterChange = useCallback((newFilter: string) => {
    setStatusFilter(newFilter)
    setCurrentPage(1) // Reset to first page
    setCachedPages({}) // Clear cache when filter changes
  }, [])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)

    // Clear cache on refresh
    setCachedPages({})

    if (dealership?.id) {
      // Refresh status counts
      await fetchStatusCounts(dealership.id)
      
      // Refresh count first
      await fetchTotalCount(dealership.id, statusFilter)

      // Then refresh current page
      await fetchPageClips(dealership.id, currentPage, statusFilter)
    }

    setRefreshing(false)
  }, [dealership?.id, currentPage, statusFilter, fetchStatusCounts, fetchTotalCount, fetchPageClips])

  // Handle page change with debounce to prevent rapid changes
  const handlePageChange = useCallback((page: number) => {
    if (isPageLoading) return

    setCurrentPage(page)
    scrollRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [isPageLoading])

  // ENHANCED: Handle delete with proper validation
  const handleDelete = useCallback(async (clipId: number) => {
    Alert.alert(
      'Delete AutoClip',
      'Are you sure you want to delete this clip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('auto_clips')
                .delete()
                .eq('id', clipId)

              if (error) throw error

              // Clear cache and refresh data
              setCachedPages({})

              if (dealership?.id) {
                await fetchStatusCounts(dealership.id)
                await fetchTotalCount(dealership.id, statusFilter)
                await fetchPageClips(dealership.id, currentPage, statusFilter)
              }

              Alert.alert('Success', 'AutoClip deleted successfully')
            } catch (error) {
              console.error('Error deleting clip:', error)
              Alert.alert('Error', 'Failed to delete AutoClip')
            }
          }
        }
      ]
    )
  }, [dealership?.id, currentPage, statusFilter, fetchStatusCounts, fetchTotalCount, fetchPageClips])

  // ENHANCED: Handle status toggle with proper workflow
  const toggleStatus = useCallback(async (clip: AutoClip) => {
    try {
      let newStatus: string
      let updateData: any = {}

      switch (clip.status) {
       
        case 'under_review':
          newStatus = 'published'
          updateData = {
            status: newStatus,
            submitted_at: null
          }
          break
        case 'published':
          newStatus = 'archived'
          updateData = {
            status: newStatus,
            published_at: null
          }
          break
        default:
          Alert.alert('Invalid Action', 'This clip cannot be modified')
          return
      }

      const { error } = await supabase
        .from('auto_clips')
        .update(updateData)
        .eq('id', clip.id)

      if (error) throw error

      // Refresh data
      setCachedPages({})
      if (dealership?.id) {
        await fetchStatusCounts(dealership.id)
        await fetchTotalCount(dealership.id, statusFilter)
        await fetchPageClips(dealership.id, currentPage, statusFilter)
      }

    } catch (error) {
      console.error('Error updating status:', error)
      Alert.alert('Error', 'Failed to update status')
    }
  }, [dealership?.id, currentPage, statusFilter, fetchStatusCounts, fetchTotalCount, fetchPageClips])

  // Loading indicator with message
  if (loading) {
    return (
      <LinearGradient
        colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F5F5F5']}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size='large' color='#D55004' />
        <Text className={`mt-4 text-base ${isDarkMode ? 'text-white' : 'text-black'}`}>
          Loading AutoClips...
        </Text>
      </LinearGradient>
    )
  }

  return (
    <LinearGradient
      colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F5F5F5']}
      style={{ flex: 1 }}>

      {/* Header with guaranteed z-index */}
      <View style={{ zIndex: 10 }}>
        <CustomHeader title='AutoClips' dealership={dealershipData} />
      </View>

      {/* FIXED: Status Filter with proper styling */}
      <StatusFilter
        activeFilter={statusFilter}
        onFilterChange={handleStatusFilterChange}
        isDarkMode={isDarkMode}
        statusCounts={statusCounts}
      />

      {/* Add Button with higher z-index */}
      <View style={{
        position: 'absolute',
        top: Platform.OS === 'ios' ? 56 : 48,
        right: 24,
        zIndex: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}>
        <TouchableOpacity
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: isDarkMode ? 'white' : 'black',
            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => setIsCreateModalVisible(true)}>
          <FontAwesome name='plus' size={24} color='#D55004' />
        </TouchableOpacity>
      </View>

      {/* Content with lower z-index */}
      <View style={{ flex: 1, zIndex: 5 }} className='mt-3'>
        {isPageLoading && !refreshing ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 }}>
            <BlurView
              intensity={80}
              tint={isDarkMode ? 'dark' : 'light'}
              style={{ padding: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color="#D55004" style={{ marginRight: 8 }} />
              <Text style={{ color: isDarkMode ? 'white' : 'black' }}>
                Loading page {currentPage}...
              </Text>
            </BlurView>
          </View>
        ) : null}

        <FlatList
          ref={scrollRef}
          data={clips}
          renderItem={({ item }) => (
            <VideoItem
              item={item}
              onPress={() => {
                setSelectedClip(item)
                setPreviewVisible(true)
              }}
              isDarkMode={isDarkMode}
              onDelete={handleDelete}
              onToggleStatus={toggleStatus}
              onEdit={clip => {
                setClipToEdit(clip)
                setIsEditModalVisible(true)
              }}
            />
          )}
          keyExtractor={item => item.id.toString()}
          numColumns={2}
          contentContainerStyle={{
            padding: 8,
            paddingBottom: Platform.OS === 'ios' ? 100 : 80,
            paddingTop: 8
          }}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={() => <EmptyState isDarkMode={isDarkMode} statusFilter={statusFilter} />}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={true}
        />

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isDarkMode={isDarkMode}
          isPageLoading={isPageLoading}
        />

        {/* Modals */}
        <CreateAutoClipModal
          isVisible={isCreateModalVisible}
          onClose={() => setIsCreateModalVisible(false)}
          dealership={dealership}
          onSuccess={handleRefresh}
        />

        <PreviewAutoClipModal
          clip={selectedClip}
          isVisible={previewVisible}
          onClose={() => {
            setPreviewVisible(false)
            setSelectedClip(null)
          }}
          onDelete={handleDelete}
          onToggleStatus={toggleStatus}
          onEdit={handleRefresh}
        />

        <EditAutoClipModal
          isVisible={isEditModalVisible}
          onClose={() => {
            setIsEditModalVisible(false)
            setClipToEdit(null)
          }}
          clip={clipToEdit}
          onSuccess={handleRefresh}
        />
      </View>
    </LinearGradient>
  )
}
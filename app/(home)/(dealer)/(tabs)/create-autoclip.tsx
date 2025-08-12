import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Platform
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesome, Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useScrollToTop } from '@react-navigation/native'
import { useAuth } from '@/utils/AuthContext'
import CreateAutoClipModal from '@/components/CreateAutoClipModal'
import PreviewAutoClipModal from '@/components/PreviewAutoClipModal'
import EditAutoClipModal from '@/components/EditAutoClipModal'

// --- CONSTANTS ---
const { width: SCREEN_WIDTH } = Dimensions.get('window')
const ITEMS_PER_PAGE = 8

// --- TYPE DEFINITIONS ---
interface AutoClipItem {
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
  car: {
    id: number
    make: string
    model: string
    year: number
    images: string[] // Added images array
  }
}

interface Dealership {
  id: number
  name: string
  logo: string
}

interface User {
  id: string
  [key: string]: any
}

interface StatusCounts {
  all: number
  published: number
  under_review: number
  rejected: number
  archived: number
}

interface FilterItem {
  key: keyof StatusCounts
  label: string
}

// Component Props Interfaces
interface HeaderProps {
  dealership: Dealership | null
}

interface StatusFilterProps {
  activeFilter: string
  onFilterChange: (filter: string) => void
  counts: StatusCounts
}

interface ClipItemProps {
  item: AutoClipItem
  onPress: () => void
  onLongPress: () => void
}

interface EmptyStateProps {
  filter: string
}

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  isLoading: boolean
}

// --- CUSTOM HOOKS for Data Fetching & Logic ---

/**
 * @description Hook to fetch dealership information for the current user.
 */
const useDealership = (user: User | null) => {
  const [dealership, setDealership] = useState<Dealership | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return

    const fetchDealership = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('dealerships')
        .select('id, name, logo')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error fetching dealership:', error.message)
        Alert.alert('Error', 'Could not load your dealership information.')
      } else {
        setDealership(data)
      }
      setLoading(false)
    }

    fetchDealership()
  }, [user])

  return { dealership, loadingDealership: loading }
}

/**
 * @description Hook to manage fetching, filtering, and paginating AutoClips.
 */
const useAutoClips = (dealershipId: number | null) => {
  const [clips, setClips] = useState<AutoClipItem[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ 
    all: 0, 
    published: 0, 
    under_review: 0, 
    rejected: 0, 
    archived: 0 
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [initialLoading, setInitialLoading] = useState(true)
  const [filterLoading, setFilterLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (isRefresh = false, isFilterChange = false) => {
    if (!dealershipId) return

    if (isRefresh) {
      setRefreshing(true)
    } else if (isFilterChange) {
      setFilterLoading(true)
    } else {
      setInitialLoading(true)
    }

    // Fetch status counts in parallel
    const fetchCounts = async () => {
      const { data, error } = await supabase
        .from('auto_clips')
        .select('status')
        .eq('dealership_id', dealershipId)

      if (error) throw error
      
      const counts = data.reduce((acc: Partial<StatusCounts>, { status }: { status: string }) => {
        acc[status as keyof StatusCounts] = (acc[status as keyof StatusCounts] || 0) + 1
        return acc
      }, { published: 0, under_review: 0, rejected: 0, archived: 0 })
      
      const finalCounts: StatusCounts = {
        published: counts.published || 0,
        under_review: counts.under_review || 0,
        rejected: counts.rejected || 0,
        archived: counts.archived || 0,
        all: data.length
      }
      
      setStatusCounts(finalCounts)
    }

    // Fetch clips for the current page and filter
    const fetchPageData = async () => {
      let countQuery = supabase
        .from('auto_clips')
        .select('id', { count: 'exact', head: true })
        .eq('dealership_id', dealershipId)

      if (statusFilter !== 'all') {
        countQuery = countQuery.eq('status', statusFilter)
      }
      
      const { count, error: countError } = await countQuery
      if (countError) throw countError
      
      const totalPagesCalculated = Math.ceil((count || 0) / ITEMS_PER_PAGE) || 1
      setTotalPages(totalPagesCalculated)

      let page = currentPage
      if (currentPage > totalPagesCalculated) {
          page = 1
          setCurrentPage(1)
      }
      
      // Updated query to include car images
      let clipsQuery = supabase
        .from('auto_clips')
        .select('*, car:cars(id, make, model, year, images)') // Added id and images to the select
        .eq('dealership_id', dealershipId)
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

      if (statusFilter !== 'all') {
        clipsQuery = clipsQuery.eq('status', statusFilter)
      }

      const { data, error } = await clipsQuery
      if (error) throw error

      setClips(data || [])
    }

    try {
      await Promise.all([fetchCounts(), fetchPageData()])
    } catch (error: any) {
      console.error('Error fetching AutoClips data:', error.message)
      Alert.alert('Error', 'Failed to load AutoClips.')
    } finally {
      setInitialLoading(false)
      setFilterLoading(false)
      setRefreshing(false)
    }
  }, [dealershipId, currentPage, statusFilter])

  useEffect(() => {
    if (dealershipId) {
      fetchData()
    }
  }, [dealershipId, currentPage])
  
  // Handle filter changes separately to show filter loading
  useEffect(() => {
    if (dealershipId && !initialLoading) {
      fetchData(false, true)
    }
  }, [statusFilter])
  
  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter])

  const handleRefresh = () => fetchData(true)

  return {
    clips,
    initialLoading,
    filterLoading,
    refreshing,
    handleRefresh,
    statusFilter,
    setStatusFilter,
    statusCounts,
    currentPage,
    setCurrentPage,
    totalPages
  }
}

// --- UI COMPONENTS ---

const Header = React.memo<HeaderProps>(({ dealership }) => {
  const { isDarkMode } = useTheme()
  const styles = getStyles(isDarkMode)
  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>AutoClips</Text>
      {dealership && (
        <View style={styles.dealershipInfo}>
          <Image source={{ uri: dealership.logo }} style={styles.dealershipLogo} />
          <Text style={styles.dealershipName}>{dealership.name}</Text>
        </View>
      )}
    </View>
  )
})

const StatusFilter = React.memo<StatusFilterProps>(({ activeFilter, onFilterChange, counts }) => {
  const { isDarkMode } = useTheme()
  const styles = getStyles(isDarkMode)
  const filters: FilterItem[] = [
    { key: 'all', label: 'All' },
    { key: 'published', label: 'Published' },
    { key: 'under_review', label: 'Review' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'archived', label: 'Archived' },
  ]

  return (
    <View>
      <FlatList
        horizontal
        data={filters}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterListContent}
        renderItem={({ item }) => {
          const isActive = activeFilter === item.key
          const count = counts[item.key] || 0
          return (
            <TouchableOpacity
              onPress={() => onFilterChange(item.key)}
              style={[styles.filterButton, isActive && styles.filterButtonActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {item.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterCountBadge, isActive && styles.filterCountBadgeActive]}>
                  <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
})

const ClipItem = React.memo<ClipItemProps>(({ item, onPress, onLongPress }) => {
  const { isDarkMode } = useTheme()
  const styles = getStyles(isDarkMode)
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  // Get the first image from the car's images array
  const carImageUrl = item.car.images && item.car.images.length > 0 ? item.car.images[0] : null

  const statusStyles: Record<string, { icon: keyof typeof Ionicons.glyphMap, color: string }> = {
    published: { icon: 'checkmark-circle', color: '#10B981' },
    under_review: { icon: 'time', color: '#F59E0B' },
    rejected: { icon: 'close-circle', color: '#EF4444' },
    archived: { icon: 'archive', color: '#6B7280' },
  }
  const statusConfig = statusStyles[item.status]

  const handleImageLoad = () => {
    setImageLoading(false)
    setImageError(false)
  }

  const handleImageError = () => {
    setImageLoading(false)
    setImageError(true)
  }

  // Reset loading state when car image URL changes
  useEffect(() => {
    if (carImageUrl) {
      setImageLoading(true)
      setImageError(false)
    } else {
      setImageLoading(false)
      setImageError(false)
    }
  }, [carImageUrl])

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} style={styles.clipContainer} activeOpacity={0.8}>
      {/* Background gradient for when image fails or is loading */}
      <View style={styles.clipBackground} />
      
      {/* Display car image if available */}
      {carImageUrl && !imageError ? (
        <Image
          source={{ uri: carImageUrl }}
          style={styles.clipImage}
          onLoad={handleImageLoad}
          onError={handleImageError}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={styles.noImageContainer}>
          <Ionicons name="car-sport" size={40} color="#666" />
          <Text style={styles.noImageText}>No Image</Text>
        </View>
      )}
      
      {/* Loading indicator */}
      {imageLoading && carImageUrl && (
        <View style={styles.imageLoadingContainer}>
          <ActivityIndicator size="small" color="#D55004" />
        </View>
      )}
      
      <View style={styles.clipOverlay} />
      
      {/* Play button overlay to indicate it's a video */}
      <View style={styles.playButtonOverlay}>
        <View style={styles.playButton}>
          <Ionicons name="play" size={24} color="#FFFFFF" style={styles.playIcon} />
        </View>
      </View>
      
      {statusConfig && (
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
          <Ionicons name={statusConfig.icon} size={12} color="#FFF" />
        </View>
      )}

      <View style={styles.clipInfoContainer}>
        <Text style={styles.clipTitle} numberOfLines={2}>
          {item.car.year} {item.car.make} {item.car.model}
        </Text>
        <View style={styles.clipStats}>
          <FontAwesome name="eye" size={12} color="#FFF" style={styles.statIcon} />
          <Text style={styles.statText}>{item.views}</Text>
          <FontAwesome name="heart" size={12} color="#FFF" style={styles.statIcon} />
          <Text style={styles.statText}>{item.likes}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
})

const EmptyState = React.memo<EmptyStateProps>(({ filter }) => {
  const { isDarkMode } = useTheme()
  const styles = getStyles(isDarkMode)
  const messages: Record<string, string> = {
    all: "You haven't created any AutoClips yet.",
    published: "No published clips found.",
    under_review: "No clips are currently under review.",
    rejected: "You have no rejected clips.",
    archived: "No archived clips found.",
  }
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="videocam-off-outline" size={60} style={styles.emptyIcon} />
      <Text style={styles.emptyText}>{messages[filter] || messages.all}</Text>
      <Text style={styles.emptySubtext}>Tap the '+' button to create your first one!</Text>
    </View>
  )
})

const Pagination = React.memo<PaginationProps>(({ currentPage, totalPages, onPageChange, isLoading }) => {
    const { isDarkMode } = useTheme()
    const styles = getStyles(isDarkMode)

    if (totalPages <= 1) return null

    return (
        <View style={styles.paginationContainer}>
            <TouchableOpacity
                style={[styles.paginationButton, (currentPage === 1 || isLoading) && styles.paginationButtonDisabled]}
                onPress={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
            >
                <Ionicons name="chevron-back" size={22} color={isDarkMode ? '#FFF' : '#000'} />
            </TouchableOpacity>
            <Text style={styles.paginationText}>Page {currentPage} of {totalPages}</Text>
            <TouchableOpacity
                style={[styles.paginationButton, (currentPage === totalPages || isLoading) && styles.paginationButtonDisabled]}
                onPress={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
            >
                <Ionicons name="chevron-forward" size={22} color={isDarkMode ? '#FFF' : '#000'} />
            </TouchableOpacity>
        </View>
    )
})

const ContentLoadingOverlay = React.memo<{ isVisible: boolean }>(({ isVisible }) => {
  const { isDarkMode } = useTheme()
  const styles = getStyles(isDarkMode)
  
  if (!isVisible) return null
  
  return (
    <View style={styles.contentLoadingOverlay}>
      <ActivityIndicator size="large" color="#D55004" />
      <Text style={styles.contentLoadingText}>Filtering clips...</Text>
    </View>
  )
})

// --- MAIN SCREEN COMPONENT ---
export default function AutoClipsScreen() {
  const { user } = useAuth()
  const { isDarkMode } = useTheme()
  const styles = getStyles(isDarkMode)
  const flatListRef = useRef<FlatList>(null)
  
  const { dealership, loadingDealership } = useDealership(user)
  const {
    clips,
    initialLoading,
    filterLoading,
    refreshing,
    handleRefresh,
    statusFilter,
    setStatusFilter,
    statusCounts,
    currentPage,
    setCurrentPage,
    totalPages
  } = useAutoClips(dealership?.id || null)

  const [selectedClip, setSelectedClip] = useState<AutoClipItem | null>(null)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  
  useScrollToTop(flatListRef)

  const handleDelete = async (clipId: number) => {
    const { error } = await supabase.from('auto_clips').delete().eq('id', clipId)
    if (error) {
      Alert.alert('Error', 'Failed to delete clip.')
    } else {
      Alert.alert('Success', 'AutoClip deleted.')
      handleRefresh()
    }
  }

  const handleToggleStatus = async (clip: AutoClipItem) => {
    // Toggle between published and archived
    const newStatus = clip.status === 'published' ? 'archived' : 'published'
    
    const { error } = await supabase
      .from('auto_clips')
      .update({ status: newStatus })
      .eq('id', clip.id)

    if (error) {
      Alert.alert('Error', 'Failed to update clip status.')
    } else {
      Alert.alert('Success', `Clip ${newStatus === 'published' ? 'published' : 'archived'}.`)
      handleRefresh()
    }
  }

  const handleLongPress = (clip: AutoClipItem) => {
    const actions = [
        { text: 'Edit', onPress: () => { setSelectedClip(clip); setEditModalVisible(true); } },
      
        { text: 'Delete', style: 'destructive' as const, onPress: () => {
            Alert.alert(
                'Confirm Deletion',
                'Are you sure you want to permanently delete this clip?',
                [
                    { text: 'Cancel', style: 'cancel' as const },
                    { text: 'Delete', style: 'destructive' as const, onPress: () => handleDelete(clip.id) }
                ]
            )
        }}
    ]
    Alert.alert(
      `Manage Clip`,
      `${clip.car.year} ${clip.car.make} ${clip.car.model}`,
      [...actions, { text: 'Cancel', style: 'cancel' as const }]
    )
  }

  if (loadingDealership || initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D55004" />
        <Text style={styles.loadingText}>Loading Your AutoClips...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Header dealership={dealership} />
      
      <StatusFilter
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        counts={statusCounts}
      />
      
      <View style={styles.contentContainer}>
        <FlatList
          ref={flatListRef}
          data={clips}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ClipItem
              item={item}
              onPress={() => { setSelectedClip(item); setPreviewModalVisible(true) }}
              onLongPress={() => handleLongPress(item)}
            />
          )}
          numColumns={2}
          contentContainerStyle={styles.gridContentContainer}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={<EmptyState filter={statusFilter} />}
          ListFooterComponent={
              <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  isLoading={filterLoading || refreshing}
              />
          }
          ListFooterComponentStyle={{ paddingHorizontal: 16 }}
        />
        
        <ContentLoadingOverlay isVisible={filterLoading} />
      </View>

      <TouchableOpacity style={styles.addButton} onPress={() => setCreateModalVisible(true)}>
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
      
      {/* --- MODALS --- */}
      {dealership && <CreateAutoClipModal
          isVisible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          dealership={dealership}
          onSuccess={handleRefresh}
      />}
      
      <PreviewAutoClipModal
          clip={selectedClip as any}
          isVisible={previewModalVisible}
          onClose={() => setPreviewModalVisible(false)}
          onDelete={() => selectedClip && handleDelete(selectedClip.id)}
          onEdit={() => {
              setPreviewModalVisible(false)
              setEditModalVisible(true)
          }}
          onToggleStatus={() => selectedClip && handleToggleStatus(selectedClip)}
      />

      <EditAutoClipModal
          clip={(selectedClip as any) || ({} as any)}
          isVisible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          onSuccess={() => {
              setEditModalVisible(false)
              handleRefresh()
          }}
      />
    </SafeAreaView>
  )
}

// --- STYLES ---
const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: isDarkMode ? '#000000' : '#F7F7F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#000000' : '#F7F7F7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: isDarkMode ? '#FFF' : '#000',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: isDarkMode ? '#FFF' : '#000',
  },
  dealershipInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dealershipLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  dealershipName: {
    fontSize: 14,
    color: isDarkMode ? '#A1A1AA' : '#52525B',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  contentLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  contentLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: isDarkMode ? '#FFF' : '#000',
    fontWeight: '500',
  },
  filterListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: isDarkMode ? '#1C1C1E' : '#E5E5EA',
  },
  filterButtonActive: {
    backgroundColor: '#D55004',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDarkMode ? '#FFF' : '#000',
  },
  filterTextActive: {
    color: '#FFF',
  },
  filterCountBadge: {
    marginLeft: 8,
    backgroundColor: isDarkMode ? '#3A3A3C' : '#D1D1D6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: isDarkMode ? '#FFF' : '#3A3A3C',
  },
  filterCountTextActive: {
    color: '#FFF',
  },
  gridContentContainer: {
    paddingHorizontal: 12,
    paddingBottom: 100, // Space for add button and pagination
  },
  clipContainer: {
    flex: 1 / 2,
    margin: 4,
    aspectRatio: 2 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: isDarkMode ? '#1C1C1E' : '#E5E5EA',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  clipBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7',
  },
  clipImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#1C1C1E' : '#F2F2F7',
  },
  noImageText: {
    color: isDarkMode ? '#8E8E93' : '#8E8E93',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(28, 28, 30, 0.8)' : 'rgba(242, 242, 247, 0.8)',
    zIndex: 1,
  },
  clipOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 1,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  playIcon: {
    marginLeft: 3, // Slight offset to center the play icon visually
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  clipInfoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    zIndex: 2,
    backgroundColor: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  clipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  clipStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statIcon: {
    marginRight: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '500',
    marginRight: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SCREEN_WIDTH * 0.2,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    color: '#D55004',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: isDarkMode ? '#FFF' : '#000',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: isDarkMode ? '#A1A1AA' : '#6B7280',
    marginTop: 8,
  },
  addButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 85, // Adjusted for tab bar
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#D55004',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 10,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  paginationButton: {
    padding: 8,
  },
  paginationButtonDisabled: {
    opacity: 0.3,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDarkMode ? '#A1A1AA' : '#52525B',
  },
});
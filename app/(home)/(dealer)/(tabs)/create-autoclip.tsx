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
  StyleSheet
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
  status: 'published' | 'draft'
  created_at: string
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
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

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

            <View className={`px-2 py-1 rounded-full ${
              item.status === 'published' ? 'bg-emerald-500/80' : 'bg-zinc-500/80'
            }`}>
              <Text className='text-white text-xs font-medium capitalize'>
                {item.status}
              </Text>
            </View>
          </View>
        </View>

        <View className='absolute top-3 right-3 rounded-full'>
          <TouchableOpacity
            className='p-2'
            onPress={e => {
              e.stopPropagation()
              Alert.alert('Manage AutoClip', 'Choose an action', [
                {
                  text: 'Edit',
                  onPress: () => onEdit(item)
                },
                {
                  text: item.status === 'published' ? 'Unpublish' : 'Publish',
                  onPress: () => onToggleStatus(item)
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => onDelete(item.id)
                },
                {
                  text: 'Cancel',
                  style: 'cancel'
                }
              ])
            }}>
            <Ionicons name='ellipsis-vertical' size={20} color='white' />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
});

const EmptyState = React.memo(({ isDarkMode }) => (
  <View className='flex-1 justify-center items-center p-8'>
    <View className='bg-neutral-100 dark:bg-neutral-800 rounded-full p-6 mb-4'>
      <Ionicons
        name='videocam'
        size={48}
        color={isDarkMode ? '#D55004' : '#D55004'}
      />
    </View>
    <Text className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
      No AutoClips Yet
    </Text>
    <Text className={`text-center ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
      Create your first AutoClip by tapping the + button below
    </Text>
  </View>
));

const PaginationControls = React.memo(({ currentPage, totalPages, onPageChange, isDarkMode, isPageLoading }) => {
  const styles = StyleSheet.create({
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
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, (currentPage === 1 || isPageLoading) && styles.disabledButton]}
        onPress={() => !isPageLoading && onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || isPageLoading}>
        <Ionicons name="chevron-back" size={20} color="white" />
      </TouchableOpacity>

      <View style={styles.paginationInfo}>
        {isPageLoading ? (
          <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
        ) : null}
        <Text style={styles.paginationText}>
          {currentPage} / {totalPages || 1}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, (currentPage === totalPages || isPageLoading) && styles.disabledButton]}
        onPress={() => !isPageLoading && onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || isPageLoading}>
        <Ionicons name="chevron-forward" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );
});

const FloatingAddButton = React.memo(() => {
  const { isDarkMode } = useTheme();

  const buttonStyles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 48,
      right: 24,
      zIndex: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    button: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: isDarkMode ? 'white' : 'black',
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    }
  });

  return (
    <View style={buttonStyles.container}>
      <TouchableOpacity
        style={buttonStyles.button}
        onPress={() => setIsCreateModalVisible(true)}>
        <FontAwesome name='plus' size={24} color='#D55004' />
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Cache for loaded pages
  const [cachedPages, setCachedPages] = useState<{[key: number]: AutoClip[]}>({})

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

  // Separate fetch for total count
  const fetchTotalCount = useCallback(async (dealershipId: number) => {
    try {
      const { count, error } = await supabase
        .from('auto_clips')
        .select('id', { count: 'exact' })
        .eq('dealership_id', dealershipId)

      if (error) throw error

      const pages = Math.ceil((count || 0) / ITEMS_PER_PAGE)
      setTotalPages(pages || 1)
      return { success: true, totalPages: pages || 1 }
    } catch (error) {
      console.error('Error fetching count:', error)
      return { success: false, totalPages: 1 }
    }
  }, [])

  // Fetch clips for a specific page
  const fetchPageClips = useCallback(async (dealershipId: number, page: number) => {
    // Check if page is already cached
    if (cachedPages[page] && !refreshing) {
      setClips(cachedPages[page])
      return { success: true }
    }

    setIsPageLoading(true)

    try {
      const { data, error } = await supabase
        .from('auto_clips')
        .select(`
          *,
          car:cars(make, model, year)
        `)
        .eq('dealership_id', dealershipId)
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

      if (error) throw error

      // Update cache and current clips
      setCachedPages(prev => ({ ...prev, [page]: data }))
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

        // Step 2: Get total count
        const countResult = await fetchTotalCount(dealershipResult.dealershipId)
        if (!countResult.success) {
          setLoading(false)
          return
        }

        // Step 3: Get clips for first page
        await fetchPageClips(dealershipResult.dealershipId, 1)

        setLoading(false)
      }

      initializeData()
    }
  }, [user, fetchDealershipData, fetchTotalCount, fetchPageClips])

  // Handle page changes
  useEffect(() => {
    const loadPage = async () => {
      if (dealership?.id) {
        await fetchPageClips(dealership.id, currentPage)
      }
    }

    if (!loading && dealership?.id) {
      loadPage()
    }
  }, [currentPage, dealership?.id, loading, fetchPageClips])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)

    // Clear cache on refresh
    setCachedPages({})

    if (dealership?.id) {
      // Refresh count first
      await fetchTotalCount(dealership.id)

      // Then refresh current page
      await fetchPageClips(dealership.id, currentPage)
    }

    setRefreshing(false)
  }, [dealership?.id, currentPage, fetchTotalCount, fetchPageClips])

  // Handle page change with debounce to prevent rapid changes
  const handlePageChange = useCallback((page: number) => {
    if (isPageLoading) return

    setCurrentPage(page)
    scrollRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [isPageLoading])

  // Handle delete with cache update
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
                await fetchTotalCount(dealership.id)
                await fetchPageClips(dealership.id, currentPage)
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
  }, [dealership?.id, currentPage, fetchTotalCount, fetchPageClips])

  // Toggle status with cache update
  const toggleStatus = useCallback(async (clip: AutoClip) => {
    const newStatus = clip.status === 'published' ? 'draft' : 'published'
    try {
      const { error } = await supabase
        .from('auto_clips')
        .update({ status: newStatus })
        .eq('id', clip.id)

      if (error) throw error

      // Update cache for current page
      const updatedClips = clips.map(c =>
        c.id === clip.id ? { ...c, status: newStatus } : c
      )

      setClips(updatedClips)
      setCachedPages(prev => ({
        ...prev,
        [currentPage]: updatedClips
      }))

    } catch (error) {
      console.error('Error updating status:', error)
      Alert.alert('Error', 'Failed to update status')
    }
  }, [clips, currentPage])

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
          ListEmptyComponent={() => <EmptyState isDarkMode={isDarkMode} />}
          maxToRenderPerBatch={8}  // Optimize rendering batches
          windowSize={5}           // Reduce rendering window
          removeClippedSubviews={true} // Remove offscreen components
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
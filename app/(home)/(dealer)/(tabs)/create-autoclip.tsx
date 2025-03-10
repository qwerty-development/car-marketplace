import React, { useState, useEffect, useRef } from 'react'
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

const CustomHeader = ({ title, dealership }:any) => {
  const { isDarkMode } = useTheme();

  // Define standardized styles
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
};

const VideoItem = ({
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
  const [isHovered, setIsHovered] = useState(false)

  return (
    <TouchableOpacity
      onPress={onPress}
      className='relative mb-4 mx-1'
      style={{ width: VIDEO_WIDTH }}
      onPressIn={() => setIsHovered(true)}
      onPressOut={() => setIsHovered(false)}>
      <View className='rounded-2xl overflow-hidden shadow-lg'>
        <Video
          source={{ uri: item.video_url }}
          style={{
            width: VIDEO_WIDTH,
            height: VIDEO_HEIGHT
          }}
          resizeMode='cover'
          shouldPlay={false}
          isMuted={true}
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
}

const EmptyState = ({ isDarkMode }) => (
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
)

const PaginationControls = ({ currentPage, totalPages, onPageChange, isDarkMode }) => (
  <View className='left-0 fixed right-0 flex-row justify-center items-center space-x-3'>
    <TouchableOpacity
      onPress={() => onPageChange(currentPage - 1)}
      disabled={currentPage === 1}
      className={`p-2 rounded-full bg-zinc-800/80 ${currentPage === 1 ? 'opacity-30' : ''}`}>
      <Ionicons name="chevron-back" size={20} color={isDarkMode ? '#fff' : '#000'} />
    </TouchableOpacity>

    <View className='bg-zinc-800/80 px-4 py-2 rounded-full'>
      <Text className='text-white font-medium'>
        {currentPage} / {totalPages}
      </Text>
    </View>

    <TouchableOpacity
      onPress={() => onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
      className={`p-2 rounded-full bg-zinc-800/80 ${currentPage === totalPages ? 'opacity-30' : ''}`}>
      <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#fff' : '#000'} />
    </TouchableOpacity>
  </View>
)



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
  const [selectedClip, setSelectedClip] = useState<AutoClip | null>(null)
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [clipToEdit, setClipToEdit] = useState<AutoClip | null>(null)

  // Add button with correct z-index and positioning
const FloatingAddButton = () => {
  const { isDarkMode } = useTheme();

  const buttonStyles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 56 : 48,
      right: 24,
      zIndex: 20, // Higher than header
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5, // For Android shadow
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
};

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (user) {
      fetchDealershipAndClips()
    }
  }, [user, currentPage])

  const fetchDealershipAndClips = async () => {
    try {
      const { data: dealershipData, error: dealershipError } = await supabase
        .from('dealerships')
        .select('*')
        .eq('user_id', user!.id)
        .single()

      if (dealershipError) throw dealershipError
      setDealershipData(dealershipData)
      setDealership({ id: dealershipData.id })

      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('auto_clips')
        .select('id', { count: 'exact' })
        .eq('dealership_id', dealershipData.id)

      if (countError) throw countError
      setTotalPages(Math.ceil(count! / ITEMS_PER_PAGE))

      // Get paginated clips
      const { data: clipsData, error: clipsError } = await supabase
        .from('auto_clips')
        .select(`
          *,
          car:cars(make, model, year)
        `)
        .eq('dealership_id', dealershipData.id)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1)

      if (clipsError) throw clipsError
      setClips(clipsData)
    } catch (error) {
      console.error('Error:', error)
      Alert.alert('Error', 'Failed to load AutoClips')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    setCurrentPage(1)
    fetchDealershipAndClips()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    scrollRef.current?.scrollToOffset({ offset: 0, animated: true })
  }

  const handleDelete = async (clipId: number) => {
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

              // Refresh the current page after deletion
              fetchDealershipAndClips()
              Alert.alert('Success', 'AutoClip deleted successfully')
            } catch (error) {
              console.error('Error:', error)
              Alert.alert('Error', 'Failed to delete AutoClip')
            }
          }
        }
      ]
    )
  }

  const toggleStatus = async (clip: AutoClip) => {
    const newStatus = clip.status === 'published' ? 'draft' : 'published'
    try {
      const { error } = await supabase
        .from('auto_clips')
        .update({ status: newStatus })
        .eq('id', clip.id)

      if (error) throw error

      // Refresh the current page after status update
      fetchDealershipAndClips()
    } catch (error) {
      console.error('Error:', error)
      Alert.alert('Error', 'Failed to update status')
    }
  }

  if (loading) {
    return (
      <View className='flex-1 justify-center items-center'>
        <ActivityIndicator size='large' color='#D55004' />
      </View>
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
    <FloatingAddButton />

    {/* Content with lower z-index */}
    <View style={{ flex: 1, zIndex: 5 }} className='mt-3'>
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
          paddingTop: 8 // Add padding to ensure content doesn't overlap header
        }}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        ListEmptyComponent={() => <EmptyState isDarkMode={isDarkMode} />}
        ListFooterComponent={() => (
          clips.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              isDarkMode={isDarkMode}
            />
          )
        )}
      />

      {/* Modals remain unchanged */}
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
);
}
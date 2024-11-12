//createautoclip.tsx
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  TextInput,
  StatusBar
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/utils/ThemeContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FontAwesome } from '@expo/vector-icons'
import { Video } from 'expo-av'
import VideoPickerButton from '@/components/VideoPickerComponent'
import CarSelector from '@/components/CarSelector'
import CreateAutoClipModal from '@/components/CreateAutoClipModal'
import PreviewAutoClipModal from '@/components/PreviewAutoClipModal'


const CustomHeader = React.memo(({ title }: { title: string }) => {
  const { isDarkMode } = useTheme()
  return (
    <SafeAreaView
      edges={['top']}
      className={`bg-${isDarkMode ? 'black' : 'white'}`}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View className='flex-row items-center border-b border-red justify-center pb-2'>
        <Text className='text-xl font-semibold text-red'>{title}</Text>
      </View>
    </SafeAreaView>
  )
})

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


export default function AutoClips() {
  const navigation = useNavigation()
  const { user } = useUser()
  const { isDarkMode } = useTheme()
  const screenWidth = Dimensions.get('window').width

  const [clips, setClips] = useState<AutoClip[]>([])
  const [loading, setLoading] = useState(true)
  const [dealership, setDealership] = useState<{ id: number } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedClip, setSelectedClip] = useState<AutoClip | null>(null)
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)

  // Fetch dealership and clips
  useEffect(() => {
    if (user) {
      fetchDealershipAndClips()
    }
  }, [user])

  const fetchDealershipAndClips = async () => {
    try {
      // Get dealership
      const { data: dealershipData, error: dealershipError } = await supabase
        .from('dealerships')
        .select('id')
        .eq('user_id', user!.id)
        .single()

      if (dealershipError) throw dealershipError
      setDealership(dealershipData)

      // Get clips
      const { data: clipsData, error: clipsError } = await supabase
        .from('auto_clips')
        .select(`
          *,
          car:cars(make, model, year)
        `)
        .eq('dealership_id', dealershipData.id)
        .order('created_at', { ascending: false })

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
    fetchDealershipAndClips()
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
              setClips(prev => prev.filter(clip => clip.id !== clipId))
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
      setClips(prev => prev.map(c =>
        c.id === clip.id ? { ...c, status: newStatus } : c
      ))
    } catch (error) {
      console.error('Error:', error)
      Alert.alert('Error', 'Failed to update status')
    }
  }

  function PreviewModal({
    clip,
    isVisible,
    onClose,
    onDelete,
    onToggleStatus
  }: {
    clip: AutoClip | null
    isVisible: boolean
    onClose: () => void
    onDelete: (id: number) => void
    onToggleStatus: (clip: AutoClip) => void
  }) {
    const { isDarkMode } = useTheme()
    const [videoRef, setVideoRef] = useState<Video | null>(null)

    useEffect(() => {
      if (!isVisible && videoRef) {
        videoRef.stopAsync()
      }
    }, [isVisible])

    if (!clip) return null

    return (
      <Modal
        visible={isVisible}
        onRequestClose={onClose}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <LinearGradient
          colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
          className="flex-1"
        >
          <View className="flex-row justify-between mt-12 items-center p-4 border-b border-red">
            <TouchableOpacity onPress={onClose}>
              <FontAwesome name="close" size={24} color={isDarkMode ? 'white' : 'black'} />
            </TouchableOpacity>
            <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
              {clip.title}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView className="flex-1">
            <View className="bg-black">
              <Video
                ref={(ref) => setVideoRef(ref)}
                source={{ uri: clip.video_url }}
                style={{ width: '100%', aspectRatio: 16 / 9 }}
                resizeMode="contain"
                useNativeControls
                isLooping
                shouldPlay
              />
            </View>

            <View className="p-4">
              <View className="flex-row justify-between items-center mb-4">
                <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {clip.car.year} {clip.car.make} {clip.car.model}
                </Text>
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => onToggleStatus(clip)}
                    className="mr-4 bg-gray-800 p-2 rounded-full"
                  >
                    <FontAwesome
                      name={clip.status === 'published' ? 'eye' : 'eye-slash'}
                      size={20}
                      color="white"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Delete AutoClip',
                        'Are you sure you want to delete this clip?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => {
                              onDelete(clip.id)
                              onClose()
                            }
                          }
                        ]
                      )
                    }}
                    className="bg-red p-2 rounded-full"
                  >
                    <FontAwesome name="trash" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>

              {clip.description && (
                <Text className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {clip.description}
                </Text>
              )}

              <View className="flex-row justify-between">
                <View className="flex-row items-center">
                  <FontAwesome name="eye" size={16} color={isDarkMode ? 'white' : 'black'} />
                  <Text className={`ml-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    {clip.views} views
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <FontAwesome name="heart" size={16} color={isDarkMode ? 'white' : 'black'} />
                  <Text className={`ml-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    {clip.likes} likes
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </Modal>
    )
  }

  const renderClip = ({ item }: { item: AutoClip }) => (
    <TouchableOpacity
      className="w-[48%] mb-4 rounded-lg overflow-hidden bg-black"
      onPress={() => {
        setSelectedClip(item)
        setPreviewVisible(true)
      }}
    >
      <Video
        source={{ uri: item.video_url }}
        style={{ width: '100%', aspectRatio: 16 / 9 }}
        resizeMode="cover"
        shouldPlay={false}
        isMuted={true}
      />

      <View className="absolute bottom-0 left-0 right-0 p-2 bg-black/50">
        <View className="flex-row justify-between">
          <View className="flex-row items-center">
            <FontAwesome name="eye" size={12} color="white" />
            <Text className="text-white text-xs ml-1">
              {item.views}
            </Text>
          </View>
          <View className="flex-row items-center">
            <FontAwesome name="heart" size={12} color="white" />
            <Text className="text-white text-xs ml-1">
              {item.likes}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    )
  }

  return (
    <LinearGradient
      colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
      className="flex-1"
    >
      <CustomHeader title='Autoclips' />
      <SafeAreaView className="flex-1">
        <FlatList
          data={clips}
          renderItem={renderClip}
          keyExtractor={item => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingVertical: 16 }}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <Text className={`text-center mt-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              No AutoClips found
            </Text>
          }
        />

        <TouchableOpacity
          className="absolute bottom-20 right-2 w-14 h-14 rounded-full bg-red items-center justify-center shadow-lg"
          onPress={() => setIsCreateModalVisible(true)}
        >
          <FontAwesome name="plus" size={24} color="white" />
        </TouchableOpacity>

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
          onToggleStatus={toggleStatus}  // Add this
          onEdit={(clip) => {
            handleRefresh()  // Refresh the clips list after edit
          }}  // Add this
        />
      </SafeAreaView>
    </LinearGradient>
  )
}

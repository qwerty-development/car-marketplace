import React, { useState, useEffect } from 'react';
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
  StatusBar,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/utils/supabase';
import { useUser } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/utils/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { Image } from 'expo-image';
import CreateAutoClipModal from '@/components/CreateAutoClipModal';
import PreviewAutoClipModal from '@/components/PreviewAutoClipModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_WIDTH = (SCREEN_WIDTH - 24) / 2; // 24 for padding and gap
const VIDEO_HEIGHT = VIDEO_WIDTH * 1.5; // 3:2 aspect ratio

interface AutoClip {
  id: number;
  dealership_id: number;
  car_id: number;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  views: number;
  likes: number;
  status: 'published' | 'draft';
  created_at: string;
  car: {
    make: string;
    model: string;
    year: number;
  };
}

interface Dealership {
  id: number;
  name: string;
  logo: string;
  location: string;
  phone: string;
  user_id: string;
}

const CustomHeader = React.memo(({ title }: { title: string }) => {
	const { isDarkMode } = useTheme()
  
	return (
	  <SafeAreaView
		className={`bg-${isDarkMode ? 'black' : 'white'} `}>
		<StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
		<View className='flex-row ml-6'>
		  <Text className='text-2xl -mb-5 font-bold text-black dark:text-white'>{title}</Text>
		</View>
	  </SafeAreaView>
	)
  })

const DealershipHeader = ({ dealership, isDarkMode }: { dealership: Dealership | null; isDarkMode: boolean }) => (
  <View className="p-4 border-b border-gray-200">
    <View className="flex-row items-center">
      {dealership?.logo && (
        <Image
          source={{ uri: dealership.logo }}
          style={{ width: 50, height: 50, borderRadius: 25 }}
        />
      )}
      <View className="ml-3 flex-1">
        <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
          {dealership?.name}
        </Text>
        <View className="flex-row items-center">
          <Ionicons name="location-outline" size={14} color={isDarkMode ? '#e6e6e6' : '#666666'} />
          <Text 
            className={`text-sm ml-1 ${isDarkMode ? 'text-[#e6e6e6]' : 'text-gray-600'}`} 
            numberOfLines={1}
          >
            {dealership?.location}
          </Text>
        </View>
      </View>
    </View>
  </View>
);

const VideoItem = ({ 
  item, 
  onPress, 
  isDarkMode 
}: { 
  item: AutoClip; 
  onPress: () => void; 
  isDarkMode: boolean;
}) => (
  <TouchableOpacity 
    onPress={onPress}
    className="relative mb-3"
    style={{ width: VIDEO_WIDTH }}
  >
    <Video
      source={{ uri: item.video_url }}
      style={{ 
        width: VIDEO_WIDTH, 
        height: VIDEO_HEIGHT, 
        borderRadius: 12 
      }}
      resizeMode="cover"
      shouldPlay={false}
      isMuted={true}
    />
    
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.7)']}
      className="absolute bottom-0 left-0 right-0 h-12 rounded-b-xl"
    />

    <View className="absolute bottom-2 left-2 right-2  flex-row justify-between items-center">
      <View className="flex-row items-center">
        <FontAwesome name="eye" size={12} color="white" />
        <Text className="text-white text-xs ml-1">{item.views}</Text>
      </View>
      
      <View className="flex-row items-center">
        <FontAwesome name="heart" size={12} color="white" />
        <Text className="text-white text-xs ml-1">{item.likes}</Text>
      </View>
      
      <View className={`px-2 py-1 rounded-full ${
        item.status === 'published' ? 'bg-green-500/50' : 'bg-gray-500/50'
      }`}>
        <Text className="text-white text-xs capitalize">
          {item.status}
        </Text>
      </View>
    </View>

    <TouchableOpacity 
      className="absolute top-2 right-2 p-2 rounded-full bg-black/50"
      onPress={(e) => {
        e.stopPropagation();
        Alert.alert(
          'Manage AutoClip',
          'Choose an action',
          [
            {
              text: 'Edit',
              onPress: () => {
                // Handle edit
              }
            },
            {
              text: item.status === 'published' ? 'Unpublish' : 'Publish',
              onPress: () => {
                // Handle status toggle
              }
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                // Handle delete
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      }}
    >
      <Ionicons name="ellipsis-vertical" size={20} color="white" />
    </TouchableOpacity>
  </TouchableOpacity>
);

export default function AutoClips() {
  const navigation = useNavigation();
  const { user } = useUser();
  const { isDarkMode } = useTheme();
  
  const [clips, setClips] = useState<AutoClip[]>([]);
  const [dealershipData, setDealershipData] = useState<Dealership | null>(null);
  const [loading, setLoading] = useState(true);
  const [dealership, setDealership] = useState<{ id: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClip, setSelectedClip] = useState<AutoClip | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDealershipAndClips();
    }
  }, [user]);

  const fetchDealershipAndClips = async () => {
    try {
      // Get dealership with more details
      const { data: dealershipData, error: dealershipError } = await supabase
        .from('dealerships')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (dealershipError) throw dealershipError;
      setDealershipData(dealershipData);
      setDealership({ id: dealershipData.id });

      // Get clips
      const { data: clipsData, error: clipsError } = await supabase
        .from('auto_clips')
        .select(`
          *,
          car:cars(make, model, year)
        `)
        .eq('dealership_id', dealershipData.id)
        .order('created_at', { ascending: false });

      if (clipsError) throw clipsError;
      setClips(clipsData);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to load AutoClips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDealershipAndClips();
  };

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
                .eq('id', clipId);

              if (error) throw error;
              setClips(prev => prev.filter(clip => clip.id !== clipId));
              Alert.alert('Success', 'AutoClip deleted successfully');
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'Failed to delete AutoClip');
            }
          }
        }
      ]
    );
  };

  const toggleStatus = async (clip: AutoClip) => {
    const newStatus = clip.status === 'published' ? 'draft' : 'published';
    try {
      const { error } = await supabase
        .from('auto_clips')
        .update({ status: newStatus })
        .eq('id', clip.id);

      if (error) throw error;
      setClips(prev =>
        prev.map(c => (c.id === clip.id ? { ...c, status: newStatus } : c))
      );
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const renderClip = ({ item }: { item: AutoClip }) => (
    <VideoItem
      item={item}
      onPress={() => {
        setSelectedClip(item);
        setPreviewVisible(true);
      }}
      isDarkMode={isDarkMode}
    />
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
      className="flex-1"
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
	  <CustomHeader title='Autoclips'/>
      
      <View className="flex-1">
        <DealershipHeader dealership={dealershipData} isDarkMode={isDarkMode} />
        
        <FlatList
          data={clips}
          renderItem={renderClip}
          keyExtractor={item => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={{
            justifyContent: 'space-between',
            paddingHorizontal: 12
          }}
          contentContainerStyle={{ paddingVertical: 12 }}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <Text className={`text-center mt-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              No AutoClips found
            </Text>
          }
        />

        <TouchableOpacity
          className="absolute bottom-20 right-4 w-14 h-14 rounded-full bg-red items-center justify-center shadow-lg"
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
            setPreviewVisible(false);
            setSelectedClip(null);
          }}
          onDelete={handleDelete}
          onToggleStatus={toggleStatus}
          onEdit={handleRefresh}
        />
      </View>
    </LinearGradient>
  );
}
import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, Modal } from 'react-native'
import {
	GestureHandlerRootView,
	PanGestureHandler
} from 'react-native-gesture-handler'
import Animated, {
	useAnimatedGestureHandler,
	useAnimatedStyle,
	withSpring,
	runOnJS,
	useSharedValue
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { FontAwesome } from '@expo/vector-icons'
import { Video, ResizeMode } from 'expo-av'
import { useTheme } from '@/utils/ThemeContext'
import { supabase } from '@/utils/supabase'
import EditAutoClipModal from './EditAutoClipModal' // Adjust path as needed

interface AutoClip {
	id: number
	title: string
	description: string
	video_url: string
	status: 'published' | 'draft'
	likes: number
	views: number
	car?: {
		id: number
		year: number
		make: string
		model: string
	}
}

interface PreviewAutoClipModalProps {
	clip: AutoClip | null
	isVisible: boolean
	onClose: () => void
	onDelete: (id: number) => void
	onToggleStatus: (clip: AutoClip) => void
	onEdit?: (clip: AutoClip) => void
}

export default function PreviewAutoClipModal({
	clip,
	isVisible,
	onClose,
	onDelete,
	onToggleStatus,
	onEdit
}: PreviewAutoClipModalProps) {
	const { isDarkMode } = useTheme()
	const [videoRef, setVideoRef] = useState<Video | null>(null)
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const [isStatusLoading, setIsStatusLoading] = useState(false)
	const [currentClip, setCurrentClip] = useState<AutoClip | null>(null)
	const [showEditModal, setShowEditModal] = useState(false)
	const translateX = useSharedValue(0)

	useEffect(() => {
		if (clip) {
			setCurrentClip(clip)
		}
	}, [clip])

	useEffect(() => {
		if (!isVisible && videoRef) {
			videoRef.stopAsync()
		}
	}, [isVisible])

	const handleToggleStatus = async () => {
		if (!currentClip || isStatusLoading) return
		setIsStatusLoading(true)

		try {
			const newStatus =
				currentClip.status === 'published' ? 'draft' : 'published'
			const { error } = await supabase
				.from('auto_clips')
				.update({ status: newStatus })
				.eq('id', currentClip.id)

			if (error) throw error

			const updatedClip = { ...currentClip, status: newStatus }
			setCurrentClip(updatedClip)
			onToggleStatus(updatedClip)
		} catch (error) {
			console.error('Error:', error)
			Alert.alert('Error', 'Failed to update status')
		} finally {
			setIsStatusLoading(false)
		}
	}

	const panGestureEvent = useAnimatedGestureHandler({
		onActive: event => {
			if (event.translationY > 0) {
				translateX.value = event.translationY
			}
		},
		onEnd: event => {
			if (event.translationY > 100) {
				runOnJS(onClose)()
			}
			translateX.value = withSpring(0)
		}
	})

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateX.value }]
	}))

	if (!currentClip) return null

	const renderPreviewMode = () => (
		<>
			<Video
				ref={ref => setVideoRef(ref)}
				source={{ uri: currentClip.video_url }}
				className='absolute inset-0 w-full h-full'
				resizeMode={ResizeMode.COVER}
				useNativeControls
				isLooping
				shouldPlay
			/>

			<TouchableOpacity
				onPress={onClose}
				className='absolute top-12 left-4 bg-black/50 p-2 rounded-full'>
				<FontAwesome name='chevron-down' size={20} color='white' />
			</TouchableOpacity>

			<View className='absolute right-4 bottom-32'>
				<TouchableOpacity className='bg-black/50 p-3 rounded-full mb-4 items-center'>
					<FontAwesome name='heart' size={25} color='white' />
					<Text className='text-white text-center mt-1 text-sm'>
						{currentClip.likes}
					</Text>
				</TouchableOpacity>

				<TouchableOpacity className='bg-black/50 p-3 rounded-full items-center'>
					<FontAwesome name='eye' size={25} color='white' />
					<Text className='text-white text-center mt-1 text-sm'>
						{currentClip.views}
					</Text>
				</TouchableOpacity>
			</View>

			<LinearGradient
				colors={['transparent', 'rgba(0,0,0,0.9)']}
				className='absolute bottom-0 left-0 right-0 pb-8 pt-16'>
				<View className='px-4'>
					<Text className='text-white text-base mb-2'>
						{currentClip.car?.year} {currentClip.car?.make}{' '}
						{currentClip.car?.model}
					</Text>

					<TouchableOpacity
						onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
						activeOpacity={0.9}>
						<Text className='text-white text-lg font-bold mb-1'>
							{currentClip.title}
						</Text>
						{currentClip.description && (
							<Text
								className='text-neutral-300'
								numberOfLines={isDescriptionExpanded ? undefined : 2}>
								{currentClip.description}
							</Text>
						)}
					</TouchableOpacity>

					<View className='flex-row mt-4'>
						<TouchableOpacity
							onPress={handleToggleStatus}
							disabled={isStatusLoading}
							className={`bg-black/50 p-2 px-4 rounded-full mr-3 flex-row items-center ${
								isStatusLoading ? 'opacity-50' : ''
							}`}>
							<FontAwesome
								name={currentClip.status === 'published' ? 'eye' : 'eye-slash'}
								size={16}
								color='white'
							/>
							<Text className='text-white ml-2'>
								{isStatusLoading
									? 'Updating...'
									: currentClip.status === 'published'
									? 'Published'
									: 'Draft'}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={() => setShowEditModal(true)}
							className='bg-black/50 p-2 px-4 rounded-full mr-3 flex-row items-center'>
							<FontAwesome name='edit' size={16} color='white' />
							<Text className='text-white ml-2'>Edit</Text>
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
												onDelete(currentClip.id)
												onClose()
											}
										}
									]
								)
							}}
							className='bg-red/50 p-2 px-4 rounded-full flex-row items-center'>
							<FontAwesome name='trash' size={16} color='white' />
							<Text className='text-white ml-2'>Delete</Text>
						</TouchableOpacity>
					</View>
				</View>
			</LinearGradient>
		</>
	)

	return (
		<Modal
			visible={isVisible}
			onRequestClose={onClose}
			animationType='slide'
			presentationStyle='fullScreen'
			statusBarTranslucent>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<LinearGradient
					colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
					className='flex-1'>
					<PanGestureHandler onGestureEvent={panGestureEvent}>
						<Animated.View
							style={[{ flex: 1 }, animatedStyle]}
							className={isDarkMode ? 'bg-black' : 'bg-white'}>
							{renderPreviewMode()}
						</Animated.View>
					</PanGestureHandler>
				</LinearGradient>
			</GestureHandlerRootView>

			<EditAutoClipModal
				isVisible={showEditModal}
				onClose={() => setShowEditModal(false)}
				clip={currentClip}
				onSuccess={() => {
					setShowEditModal(false)
					if (onEdit) {
						onEdit(currentClip)
					}
				}}
			/>
		</Modal>
	)
}

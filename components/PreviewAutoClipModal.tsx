import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, Modal, StyleSheet, Dimensions, StatusBar } from 'react-native'
import {
	GestureHandlerRootView,
	Gesture,
	GestureDetector
} from 'react-native-gesture-handler'
import Animated, {
	useAnimatedStyle,
	withSpring,
	runOnJS,
	useSharedValue
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { FontAwesome } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useTheme } from '@/utils/ThemeContext'
import { supabase } from '@/utils/supabase'
import EditAutoClipModal from './EditAutoClipModal'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface AutoClip {
	id: number
	title: string
	description: string
	video_url: string
	status: 'published' | 'draft' | 'under_review' | 'rejected' | 'archived'
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
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const [isStatusLoading, setIsStatusLoading] = useState(false)
	const [currentClip, setCurrentClip] = useState<AutoClip | null>(null)
	const [showEditModal, setShowEditModal] = useState(false)
	const translateY = useSharedValue(0)

	const player = useVideoPlayer(clip?.video_url ?? null, player => {
		player.loop = true
	})

	const styles = getStyles(isDarkMode)

	useEffect(() => {
		if (clip) {
			setCurrentClip(clip)
			setIsDescriptionExpanded(false)
		}
	}, [clip])

	useEffect(() => {
		if (!isVisible) {
			player.pause()
		} else if (isVisible && clip?.video_url) {
			player.play()
		}
	}, [isVisible, clip?.video_url, player])

	const panGesture = Gesture.Pan()
		.onUpdate(event => {
			if (event.translationY > 0) {
				translateY.value = event.translationY
			}
		})
		.onEnd(event => {
			if (event.translationY > 100) {
				runOnJS(onClose)()
			}
			translateY.value = withSpring(0)
		})

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }]
	}))


	if (!currentClip) return null

	const getStatusConfig = () => {
		switch (currentClip.status) {
			case 'published':
				return { icon: 'eye' as const, text: 'Published' }
			case 'draft':
				return { icon: 'eye-slash' as const, text: 'Draft' }
			case 'under_review':
				return { icon: 'clock-o' as const, text: 'Under Review' }
			case 'rejected':
				return { icon: 'times' as const, text: 'Rejected' }
			case 'archived':
				return { icon: 'archive' as const, text: 'Archived' }
			default:
				return { icon: 'eye-slash' as const, text: 'Draft' }
		}
	}

	const statusConfig = getStatusConfig()

	const renderPreviewMode = () => (
		<>
			<VideoView
				player={player}
				style={styles.video}
				contentFit="cover"
				nativeControls
			/>

			<TouchableOpacity
				onPress={onClose}
				style={styles.closeButton}
				activeOpacity={0.7}>
				<FontAwesome name="chevron-down" size={20} color="white" />
			</TouchableOpacity>

			<View style={styles.rightActions}>
				<TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
					<FontAwesome name="heart" size={25} color="white" />
					<Text style={styles.actionText}>{currentClip.likes}</Text>
				</TouchableOpacity>

				<TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
					<FontAwesome name="eye" size={25} color="white" />
					<Text style={styles.actionText}>{currentClip.views}</Text>
				</TouchableOpacity>
			</View>

			<LinearGradient
				colors={['transparent', 'rgba(0,0,0,0.9)']}
				style={styles.bottomGradient}>
				<View style={styles.bottomContent}>
					<Text style={styles.carInfo}>
						{currentClip.car?.year} {currentClip.car?.make} {currentClip.car?.model}
					</Text>

					<TouchableOpacity
						onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
						activeOpacity={0.9}>
						<Text style={styles.title}>{currentClip.title}</Text>
						{currentClip.description && (
							<Text
								style={styles.description}
								numberOfLines={isDescriptionExpanded ? undefined : 2}>
								{currentClip.description}
							</Text>
						)}
					</TouchableOpacity>

					<View style={styles.actionRow}>

						<TouchableOpacity
							onPress={() => setShowEditModal(true)}
							style={styles.actionRowButton}
							activeOpacity={0.7}>
							<FontAwesome name="edit" size={16} color="white" />
							<Text style={styles.actionRowText}>Edit</Text>
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
							style={styles.deleteButton}
							activeOpacity={0.7}>
							<FontAwesome name="trash" size={16} color="white" />
							<Text style={styles.actionRowText}>Delete</Text>
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
			animationType="slide"
			presentationStyle="fullScreen"
			statusBarTranslucent>
			<StatusBar hidden />
			<GestureHandlerRootView style={styles.container}>
				<LinearGradient
					colors={isDarkMode ? ['#000000', '#1A1A1A'] : ['#FFFFFF', '#F0F0F0']}
					style={styles.container}>
					<GestureDetector gesture={panGesture}>
						<Animated.View
							style={[styles.container, animatedStyle, isDarkMode ? styles.darkBackground : styles.lightBackground]}>
							{renderPreviewMode()}
						</Animated.View>
					</GestureDetector>
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

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
	container: {
		flex: 1,
	},
	darkBackground: {
		backgroundColor: '#000000',
	},
	lightBackground: {
		backgroundColor: '#FFFFFF',
	},
	video: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: SCREEN_WIDTH,
		height: SCREEN_HEIGHT,
	},
	closeButton: {
		position: 'absolute',
		top: 48,
		left: 16,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		padding: 8,
		borderRadius: 20,
		zIndex: 10,
	},
	rightActions: {
		position: 'absolute',
		right: 16,
		bottom: 200,
		zIndex: 10,
	},
	actionButton: {
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		padding: 12,
		borderRadius: 25,
		marginBottom: 16,
		alignItems: 'center',
		minWidth: 50,
	},
	actionText: {
		color: 'white',
		textAlign: 'center',
		marginTop: 4,
		fontSize: 12,
		fontWeight: '500',
	},
	bottomGradient: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		paddingBottom: 32,
		paddingTop: 64,
	},
	bottomContent: {
		paddingHorizontal: 16,
	},
	carInfo: {
		color: 'white',
		fontSize: 16,
		marginBottom: 8,
		fontWeight: '500',
	},
	title: {
		color: 'white',
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	description: {
		color: '#D1D5DB',
		fontSize: 14,
		lineHeight: 20,
	},
	actionRow: {
		flexDirection: 'row',
		marginTop: 16,
		flexWrap: 'wrap',
	},
	actionRowButton: {
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 20,
		marginRight: 12,
		marginBottom: 8,
		flexDirection: 'row',
		alignItems: 'center',
	},
	actionRowButtonDisabled: {
		opacity: 0.5,
	},
	deleteButton: {
		backgroundColor: 'rgba(239, 68, 68, 0.7)',
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 20,
		marginRight: 12,
		marginBottom: 8,
		flexDirection: 'row',
		alignItems: 'center',
	},
	actionRowText: {
		color: 'white',
		marginLeft: 8,
		fontSize: 14,
		fontWeight: '500',
	},
});
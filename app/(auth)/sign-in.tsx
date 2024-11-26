import React, { useEffect, useCallback, useState } from 'react'
import { useSignIn } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import {
	Text,
	TextInput,
	TouchableOpacity,
	View,
	KeyboardAvoidingView,
	Platform,
	Animated,
	Dimensions,
	ActivityIndicator,
	Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { useOAuth } from '@clerk/clerk-expo'
import { maybeCompleteAuthSession } from 'expo-web-browser'

// Complete auth session
maybeCompleteAuthSession()

const { width, height } = Dimensions.get('window')

interface AnimatedLineProps {
	startPos: { x: number; y: number }
	duration: number
}

const AnimatedLine: React.FC<AnimatedLineProps> = ({ startPos, duration }) => {
	const position = new Animated.Value(0)

	useEffect(() => {
		Animated.loop(
			Animated.timing(position, {
				toValue: 1,
				duration: duration,
				useNativeDriver: true
			})
		).start()
	}, [duration])

	return (
		<Animated.View
			style={{
				position: 'absolute',
				left: startPos.x,
				top: startPos.y,
				width: 1,
				height: 100,
				backgroundColor: '#D55004',
				transform: [
					{
						translateY: position.interpolate({
							inputRange: [0, 1],
							outputRange: [0, height + 100]
						})
					}
				]
			}}
		/>
	)
}

interface FadingCircleProps {
	position: { x: number; y: number }
	size: number
}

const FadingCircle: React.FC<FadingCircleProps> = ({ position, size }) => {
	const opacity = new Animated.Value(0)

	useEffect(() => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(opacity, {
					toValue: 0.5,
					duration: 2000,
					useNativeDriver: true
				}),
				Animated.timing(opacity, {
					toValue: 0,
					duration: 2000,
					useNativeDriver: true
				})
			])
		).start()
	}, [])

	return (
		<Animated.View
			style={{
				position: 'absolute',
				left: position.x,
				top: position.y,
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: '#D55004',
				opacity: opacity
			}}
		/>
	)
}

const SignInWithOAuth = () => {
	const [isLoading, setIsLoading] = useState<{
		google: boolean
		apple: boolean
	}>({ google: false, apple: false })
	const { startOAuthFlow: googleAuth } = useOAuth({ strategy: 'oauth_google' })
	const { startOAuthFlow: appleAuth } = useOAuth({ strategy: 'oauth_apple' })
	const router = useRouter()

	const onSelectAuth = async (strategy: 'google' | 'apple') => {
		try {
			setIsLoading(prev => ({ ...prev, [strategy]: true }))
			const selectedAuth = strategy === 'google' ? googleAuth : appleAuth
			const { createdSessionId, setActive } = await selectedAuth()

			if (createdSessionId) {
				setActive && (await setActive({ session: createdSessionId }))
				router.replace('/(home)')
			}
		} catch (err) {
			console.error('OAuth error:', err)
			Alert.alert(
				'Authentication Error',
				'Failed to authenticate with ' +
					strategy.charAt(0).toUpperCase() +
					strategy.slice(1)
			)
		} finally {
			setIsLoading(prev => ({ ...prev, [strategy]: false }))
		}
	}

	return (
		<View className='w-full space-y-3'>
			<View className='flex-row items-center justify-center space-x-2 mb-4 mt-0'>
				<View className='flex-1 h-[1px] bg-gray/20' />
				<Text className='text-gray-300 px-2'>Or continue with</Text>
				<View className='flex-1 h-[1px] bg-gray/20' />
			</View>

			<TouchableOpacity
				onPress={() => onSelectAuth('google')}
				disabled={isLoading.google}
				className='flex-row items-center justify-center space-x-2 bg-white p-4 rounded-lg'>
				{isLoading.google ? (
					<ActivityIndicator size='small' color='#000' />
				) : (
					<>
						<Ionicons name='logo-google' size={24} color='#000' />
						<Text className='font-semibold text-black'>
							Continue with Google
						</Text>
					</>
				)}
			</TouchableOpacity>

			<TouchableOpacity
				onPress={() => onSelectAuth('apple')}
				disabled={isLoading.apple}
				className='flex-row items-center justify-center space-x-2 bg-black border border-white/20 p-4 rounded-lg'>
				{isLoading.apple ? (
					<ActivityIndicator size='small' color='#FFF' />
				) : (
					<>
						<Ionicons name='logo-apple' size={24} color='#FFF' />
						<Text className='font-semibold text-white'>
							Continue with Apple
						</Text>
					</>
				)}
			</TouchableOpacity>
		</View>
	)
}

export default function SignInPage() {
	const { signIn, setActive, isLoaded } = useSignIn()
	const router = useRouter()

	const [emailAddress, setEmailAddress] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [emailError, setEmailError] = useState('')
	const [passwordError, setPasswordError] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [isLoading, setIsLoading] = useState(false)

	const togglePasswordVisibility = () => setShowPassword(!showPassword)

	const onSignInPress = useCallback(async () => {
		if (!isLoaded || !signIn) return

		let hasError = false
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

		if (!emailAddress) {
			setEmailError('Email is required')
			hasError = true
		} else if (!emailRegex.test(emailAddress)) {
			setEmailError('Please enter a valid email address')
			hasError = true
		} else {
			setEmailError('')
		}

		if (!password) {
			setPasswordError('Password is required')
			hasError = true
		} else {
			setPasswordError('')
		}

		if (hasError) return

		setIsLoading(true)
		try {
			const signInAttempt = await signIn.create({
				identifier: emailAddress,
				password
			})

			if (signInAttempt.status === 'complete') {
				await setActive({ session: signInAttempt.createdSessionId })
				router.replace('/(home)')
			} else {
				setEmailError('Sign in failed. Please try again.')
			}
		} catch (err: any) {
			console.error(JSON.stringify(err, null, 2))
			setEmailError(
				err.errors?.[0]?.message || 'An error occurred. Please try again.'
			)
		} finally {
			setIsLoading(false)
		}
	}, [isLoaded, signIn, emailAddress, password, setActive, router])

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			className='flex-1 bg-black'>
			<AnimatedLine startPos={{ x: width * 0.2, y: -100 }} duration={15000} />
			<AnimatedLine startPos={{ x: width * 0.5, y: -100 }} duration={20000} />
			<AnimatedLine startPos={{ x: width * 0.8, y: -100 }} duration={18000} />

			<FadingCircle position={{ x: width * 0.1, y: height * 0.1 }} size={100} />
			<FadingCircle position={{ x: width * 0.7, y: height * 0.3 }} size={150} />
			<FadingCircle position={{ x: width * 0.3, y: height * 0.8 }} size={120} />

			<View className='flex-1 justify-center px-8'>
				<Text className='text-4xl font-bold mb-8 text-[#D55004] text-center'>
					Sign In
				</Text>

				<View className='mb-4 space-y-4'>
					<View>
						<TextInput
							className='w-full h-12 px-4 bg-[#1F2937] text-white rounded-lg border border-[#374151]'
							autoCapitalize='none'
							value={emailAddress}
							placeholder='Email'
							placeholderTextColor='#6B7280'
							onChangeText={setEmailAddress}
							keyboardType='email-address'
							autoComplete='email'
							editable={!isLoading}
						/>
						{emailError && (
							<Text className='text-[#D55004] text-sm mt-1'>{emailError}</Text>
						)}
					</View>

					<View>
						<View className='relative'>
							<TextInput
								className='w-full h-12 px-4 bg-[#1F2937] text-white rounded-lg border border-[#374151]'
								value={password}
								placeholder='Password'
								placeholderTextColor='#6B7280'
								secureTextEntry={!showPassword}
								onChangeText={setPassword}
								autoComplete='password'
								editable={!isLoading}
							/>
							<TouchableOpacity
								className='absolute right-4 top-3'
								onPress={togglePasswordVisibility}
								disabled={isLoading}>
								<Ionicons
									name={showPassword ? 'eye-off' : 'eye'}
									size={24}
									color='#6B7280'
								/>
							</TouchableOpacity>
						</View>
						{passwordError && (
							<Text className='text-[#D55004] text-sm mt-1'>
								{passwordError}
							</Text>
						)}
					</View>
				</View>

				{error && (
					<Text className='text-[#D55004] text-center mb-4'>{error}</Text>
				)}

				<TouchableOpacity
					className={`bg-[#D55004] py-4 rounded-lg  flex-row justify-center items-center ${
						isLoading ? 'opacity-70' : ''
					}`}
					onPress={onSignInPress}
					disabled={isLoading}>
					{isLoading ? (
						<ActivityIndicator color='white' />
					) : (
						<Text className='text-white font-bold text-lg text-center'>
							Sign In
						</Text>
					)}
				</TouchableOpacity>

				<SignInWithOAuth />

				<View className='flex-row justify-center mt-6'>
					<Text className='text-[#9CA3AF]'>Don't have an account? </Text>
					<Link href='/sign-up' asChild>
						<TouchableOpacity>
							<Text className='text-[#D55004] font-bold'>Sign up</Text>
						</TouchableOpacity>
					</Link>
				</View>

				<TouchableOpacity
					onPress={() => router.push('/forgot-password')}
					className='mx-auto mt-4'>
					<Text className='text-white underline text-center'>
						Forgot Password?
					</Text>
				</TouchableOpacity>
			</View>
		</KeyboardAvoidingView>
	)
}

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
	Dimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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

export default function SignInPage() {
	const { signIn, setActive, isLoaded } = useSignIn()
	const router = useRouter()

	const [emailAddress, setEmailAddress] = React.useState('')
	const [password, setPassword] = React.useState('')
	const [error, setError] = React.useState('')
	const [emailError, setEmailError] = useState('') //new
	const [passwordError, setPasswordError] = useState('') //new
	const [showPassword, setShowPassword] = useState(false)

	const togglePasswordVisibility = () => setShowPassword(!showPassword)
	const onSignInPress = useCallback(async () => {
		if (!isLoaded || !signIn) return

		let hasError = false

		// Regular expression to validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

		// Check if email is entered and valid
		if (!emailAddress) {
			setEmailError('Email is required')
			hasError = true
		} else if (!emailRegex.test(emailAddress)) {
			setEmailError('Please enter a valid email address')
			hasError = true
		} else {
			setEmailError('')
		}

		// Check if password is entered
		if (!password) {
			setPasswordError('Password is required')
			hasError = true
		} else {
			setPasswordError('')
		}

		if (hasError) return

		try {
			const signInAttempt = await signIn.create({
				identifier: emailAddress,
				password
			})

			if (signInAttempt.status === 'complete') {
				await setActive({ session: signInAttempt.createdSessionId })
				router.replace('/')
			} else {
				setEmailError('Sign in failed. Please try again.')
			}
		} catch (err: any) {
			console.error(JSON.stringify(err, null, 2))
			setEmailError(
				err.errors?.[0]?.message || 'An error occurred. Please try again.'
			)
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

			<View
				style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>
				<Text
					style={{
						fontSize: 36,
						fontWeight: 'bold',
						marginBottom: 32,
						color: '#D55004',
						textAlign: 'center'
					}}>
					Sign In
				</Text>
				<View style={{ marginBottom: 16 }}>
					<TextInput
						style={{
							width: '100%',
							height: 48,
							paddingHorizontal: 16,
							backgroundColor: '#1F2937',
							color: 'white',
							borderRadius: 8,
							borderWidth: 1,
							borderColor: '#374151',
							marginBottom: 16
						}}
						autoCapitalize='none'
						value={emailAddress}
						placeholder='Email'
						placeholderTextColor='#6B7280'
						onChangeText={setEmailAddress}
						keyboardType='email-address'
					/>
					{emailError ? (
						<Text style={{ color: '#D55004', marginBottom: 16 }}>
							{emailError}
						</Text>
					) : null}

					<View className='relative'>
						<TextInput
							style={{
								width: '100%',
								height: 48,
								paddingHorizontal: 16,
								backgroundColor: '#1F2937',
								color: 'white',
								borderRadius: 8,
								borderWidth: 1,
								borderColor: '#374151'
							}}
							value={password}
							placeholder='Password'
							placeholderTextColor='#6B7280'
							secureTextEntry={!showPassword}
							onChangeText={setPassword}
						/>
						<TouchableOpacity
							className='absolute right-4 top-3'
							onPress={togglePasswordVisibility}>
							<Ionicons
								name={showPassword ? 'eye-off' : 'eye'}
								size={24}
								color='#6B7280'
							/>
						</TouchableOpacity>
					</View>
					{passwordError ? (
						<Text style={{ color: '#D55004', marginBottom: 16 }}>
							{passwordError}
						</Text>
					) : null}
				</View>
				{error ? (
					<Text className='text-[#D55004] mt-4 text-center'>{error}</Text>
				) : null}
				<TouchableOpacity
					style={{
						backgroundColor: '#D55004',
						paddingVertical: 12,
						borderRadius: 8,
						marginTop: 32
					}}
					onPress={onSignInPress}>
					<Text
						style={{
							color: 'white',
							fontWeight: 'bold',
							fontSize: 18,
							textAlign: 'center'
						}}>
						Sign In
					</Text>
				</TouchableOpacity>
				<View
					style={{
						flexDirection: 'row',
						justifyContent: 'center',
						marginTop: 24
					}}>
					<Text style={{ color: '#9CA3AF' }}>Don't have an account? </Text>
					<Link href='/sign-up'>
						<Text style={{ color: '#D55004', fontWeight: 'bold' }}>
							Sign up
						</Text>
					</Link>
				</View>
				<TouchableOpacity
					onPress={() => router.push('/forgot-password')}
					className='mx-auto'>
					<Text className={`text-white underline`}>Forgot Password?</Text>
				</TouchableOpacity>
			</View>
		</KeyboardAvoidingView>
	)
}

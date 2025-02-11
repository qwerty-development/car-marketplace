import React, { useEffect, useRef, useState } from 'react'
import { useSignUp } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import {
	Text,
	TextInput,
	TouchableOpacity,
	View,
	KeyboardAvoidingView,
	Platform,
	Animated,
	Dimensions,
	ScrollView,
	Alert,
	ActivityIndicator
} from 'react-native'
import { supabase } from '@/utils/supabase'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { useOAuth } from '@clerk/clerk-expo'
import { maybeCompleteAuthSession } from 'expo-web-browser'

// Complete auth session
maybeCompleteAuthSession()

const { width, height } = Dimensions.get('window')

const AnimatedLine: React.FC<{
	startPos: { x: number; y: number }
	duration: number
}> = ({ startPos, duration }) => {
	const position = useRef(new Animated.Value(0)).current

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

const FadingCircle: React.FC<{
	position: { x: number; y: number }
	size: number
}> = ({ position, size }) => {
	const opacity = useRef(new Animated.Value(0)).current

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

const SignUpWithOAuth = () => {
	const [isLoading, setIsLoading] = useState<{
	  google: boolean;
	  apple: boolean;
	}>({ google: false, apple: false });
	const { startOAuthFlow: googleAuth } = useOAuth({ strategy: 'oauth_google' });
	const { startOAuthFlow: appleAuth } = useOAuth({ strategy: 'oauth_apple' });
	const router = useRouter();
  
	const onSelectAuth = async (strategy: 'google' | 'apple') => {
	  try {
		setIsLoading(prev => ({ ...prev, [strategy]: true }));
		const selectedAuth = strategy === 'google' ? googleAuth : appleAuth;
		const { createdSessionId, setActive } = await selectedAuth();
  
		if (createdSessionId) {
		  setActive && (await setActive({ session: createdSessionId }));
		  router.replace('/(home)');
		}
	  } catch (err) {
		console.error('OAuth error:', err);
		Alert.alert(
		  'Authentication Error',
		  'Failed to authenticate with ' +
			strategy.charAt(0).toUpperCase() +
			strategy.slice(1)
		);
	  } finally {
		setIsLoading(prev => ({ ...prev, [strategy]: false }));
	  }
	};
  

	return (
		<View className="w-full flex mt-8 items-center justify-center">
		<View className="flex-row space-x-4">
		  <TouchableOpacity
			onPress={() => onSelectAuth('google')}
			disabled={isLoading.google}
			className="items-center justify-center bg-black border-white/20 border w-14 h-14 rounded-full"
		  >
			{isLoading.google ? (
			  <ActivityIndicator size="small" color="#fff" />
			) : (
			  <Ionicons name="logo-google" size={24} color="#fff" />
			)}
		  </TouchableOpacity>
  
		  <TouchableOpacity
			onPress={() => onSelectAuth('apple')}
			disabled={isLoading.apple}
			className="items-center justify-center bg-black border border-white/20 w-14 h-14 rounded-full"
		  >
			{isLoading.apple ? (
			  <ActivityIndicator size="small" color="#FFF" />
			) : (
			  <Ionicons name="logo-apple" size={24} color="#FFF" />
			)}
		  </TouchableOpacity>
		</View>
	  </View>
	)
}

export default function SignUpScreen() {
	const { isLoaded, signUp, setActive } = useSignUp()
	const router = useRouter()

	const [name, setName] = useState('')
	const [emailAddress, setEmailAddress] = useState('')
	const [password, setPassword] = useState('')
	const [pendingVerification, setPendingVerification] = useState(false)
	const [code, setCode] = useState('')
	const [errors, setErrors] = useState({
		name: '',
		email: '',
		password: '',
		code: '',
		general: ''
	})
	const [showPassword, setShowPassword] = useState(false)
	const [isLoading, setIsLoading] = useState(false)

	const togglePasswordVisibility = () => setShowPassword(!showPassword)

	const validateInputs = () => {
		let isValid = true
		const newErrors = {
			name: '',
			email: '',
			password: '',
			code: '',
			general: ''
		}

		if (!name.trim()) {
			newErrors.name = 'Name is required'
			isValid = false
		}

		if (!emailAddress.trim()) {
			newErrors.email = 'Email is required'
			isValid = false
		} else if (!/\S+@\S+\.\S+/.test(emailAddress)) {
			newErrors.email = 'Invalid email format'
			isValid = false
		}

		if (!password) {
			newErrors.password = 'Password is required'
			isValid = false
		} else if (password.length < 8) {
			newErrors.password = 'Password must be at least 8 characters long'
			isValid = false
		}

		setErrors(newErrors)
		return isValid
	}

	const onSignUpPress = async () => {
		if (!isLoaded) return
		if (!validateInputs()) return

		setIsLoading(true)
		try {
			await signUp.create({
				emailAddress,
				password
			})
			await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
			setPendingVerification(true)
		} catch (err: any) {
			console.error(JSON.stringify(err, null, 2))
			setErrors(prev => ({
				...prev,
				general: err.errors?.[0]?.message || 'Sign up failed. Please try again.'
			}))
		} finally {
			setIsLoading(false)
		}
	}

	const onPressVerify = async () => {
		if (!isLoaded) return
		if (!code.trim()) {
			setErrors(prev => ({ ...prev, code: 'Verification code is required' }))
			return
		}

		setIsLoading(true)
		try {
			const completeSignUp = await signUp.attemptEmailAddressVerification({
				code
			})

			if (completeSignUp.status !== 'complete') {
				setErrors(prev => ({
					...prev,
					code: 'Verification failed. Please try again.'
				}))
				return
			}

			const { createdSessionId, createdUserId } = completeSignUp

			if (!createdSessionId || !createdUserId) {
				setErrors(prev => ({
					...prev,
					general: 'Failed to complete sign up. Please try again.'
				}))
				return
			}

			await setActive({ session: createdSessionId })

			const { error: supabaseError } = await supabase.from('users').insert({
				id: createdUserId,
				name: name,
				email: emailAddress,
				created_at: new Date().toISOString()
			})

			if (supabaseError) {
				console.error('Error creating user in Supabase:', supabaseError)
				Alert.alert(
					'Account Created',
					'Your account was created successfully, but there was an issue saving additional information. You can update your profile later.'
				)
			}

			router.replace('/(home)')
		} catch (err: any) {
			console.error(JSON.stringify(err, null, 2))
			setErrors(prev => ({
				...prev,
				general:
					err.errors?.[0]?.message || 'An error occurred. Please try again.'
			}))
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			className='flex-1 bg-black'>
			<ScrollView contentContainerStyle={{ flexGrow: 1 }}>
				<View style={{ position: 'absolute', width: '100%', height: '100%' }}>
					<AnimatedLine
						startPos={{ x: width * 0.2, y: -100 }}
						duration={15000}
					/>
					<AnimatedLine
						startPos={{ x: width * 0.5, y: -100 }}
						duration={20000}
					/>
					<AnimatedLine
						startPos={{ x: width * 0.8, y: -100 }}
						duration={18000}
					/>

					<FadingCircle
						position={{ x: width * 0.1, y: height * 0.1 }}
						size={100}
					/>
					<FadingCircle
						position={{ x: width * 0.7, y: height * 0.3 }}
						size={150}
					/>
					<FadingCircle
						position={{ x: width * 0.3, y: height * 0.8 }}
						size={120}
					/>
				</View>

				<View className='flex-1 justify-center px-8'>
					<Text className='text-4xl font-bold mb-8 text-[#D55004] text-center'>
						{pendingVerification ? 'Verify Email' : 'Sign Up'}
					</Text>
					<View className='space-y-4'>
						{!pendingVerification ? (
							<>
								<View>
									<TextInput
										className='w-full h-12 px-4 bg-gray text-white rounded-lg border border-red'
										value={name}
										placeholder='Full Name'
										placeholderTextColor='#6B7280'
										onChangeText={setName}
										autoCapitalize='words'
										autoComplete='name'
										editable={!isLoading}
									/>
									{errors.name && (
										<Text className='text-red mt-1'>{errors.name}</Text>
									)}
								</View>
								<View>
									<TextInput
										className='w-full h-12 px-4 bg-gray text-white rounded-lg border border-red'
										autoCapitalize='none'
										value={emailAddress}
										placeholder='Email'
										placeholderTextColor='#6B7280'
										onChangeText={setEmailAddress}
										keyboardType='email-address'
										autoComplete='email'
										editable={!isLoading}
									/>
									{errors.email && (
										<Text className='text-red mt-1'>{errors.email}</Text>
									)}
								</View>
								<View className='relative'>
									<TextInput
										className='w-full h-12 px-4 pr-12 bg-gray text-white rounded-lg border border-red'
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
									{errors.password && (
										<Text className='text-red mt-1'>{errors.password}</Text>
									)}
								</View>
							</>
						) : (
							<View>
								<TextInput
									className='w-full h-12 px-4 bg-gray text-white rounded-lg border border-red'
									value={code}
									placeholder='Verification Code'
									placeholderTextColor='#6B7280'
									onChangeText={setCode}
									keyboardType='number-pad'
									editable={!isLoading}
								/>
								{errors.code && (
									<Text className='text-red mt-1'>{errors.code}</Text>
								)}
							</View>
						)}
					</View>
					{errors.general ? (
						<Text className='text-red mt-4 text-center'>{errors.general}</Text>
					) : null}

					{!pendingVerification ? (
						<>
							<TouchableOpacity
								className={`bg-[#D55004] py-2 rounded-full mt- flex-row justify-center items-center ${
									isLoading ? 'opacity-70' : ''
								}`}
								onPress={onSignUpPress}
								disabled={isLoading}>
								{isLoading ? (
									<ActivityIndicator color='white' />
								) : (
									<Text className='text-white font-bold text-lg'>Sign Up</Text>
								)}
							</TouchableOpacity>

							<SignUpWithOAuth />

							<View className='flex-row justify-center mt-6'>
								<Text className='text-[#9CA3AF]'>Already have an account? </Text>
								<TouchableOpacity onPress={() => router.push('/sign-in')}>
									<Text className='text-[#D55004] font-bold'>Sign in</Text>
								</TouchableOpacity>
							</View>
						</>
					) : (
						<TouchableOpacity
							className={`bg-[#D55004] py-4 rounded-lg mt-8 flex-row justify-center items-center ${
								isLoading ? 'opacity-70' : ''
							}`}
							onPress={onPressVerify}
							disabled={isLoading}>
							{isLoading ? (
								<ActivityIndicator color='white' />
							) : (
								<Text className='text-white font-bold text-lg text-center'>
									Verify Email
								</Text>
							)}
						</TouchableOpacity>
					)}
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

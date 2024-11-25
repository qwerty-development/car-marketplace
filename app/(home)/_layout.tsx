import React, { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { supabase } from '@/utils/supabase'
import { Alert } from 'react-native'

export default function HomeLayout() {
	const { isLoaded, isSignedIn } = useAuth()
	const { user } = useUser()
	const router = useRouter()
	const segments = useSegments()
	const [shouldNavigate, setShouldNavigate] = useState(false)
	const [isCheckingUser, setIsCheckingUser] = useState(true)

	// Check/Create Supabase User
	useEffect(() => {
		const checkAndCreateUser = async () => {
			if (!user) return

			try {
				// Check if user exists in Supabase
				const { data: existingUser, error: fetchError } = await supabase
					.from('users')
					.select()
					.eq('id', user.id)
					.single()

				if (fetchError && fetchError.code !== 'PGRST116') {
					// PGRST116 is the "no rows" error code
					throw fetchError
				}

				// If user doesn't exist, create them
				if (!existingUser) {
					const { error: insertError } = await supabase.from('users').insert([
						{
							id: user.id,
							name: `${user.firstName} ${user.lastName}`,
							email: user.emailAddresses[0].emailAddress,
							favorite: []
						}
					])

					if (insertError) throw insertError
					console.log('Created new user in Supabase')
				}
			} catch (error) {
				console.error('Error in user sync:', error)
				Alert.alert(
					'Error',
					'There was a problem setting up your account. Please try again later.'
				)
			} finally {
				setIsCheckingUser(false)
			}
		}

		if (isSignedIn && user) {
			checkAndCreateUser()
		}
	}, [isSignedIn, user])

	// Role-based navigation
	useEffect(() => {
		if (!isLoaded || !user || isCheckingUser) return

		let currentRole = 'user'
		if (user.publicMetadata.role) {
			currentRole = user.publicMetadata.role as string
		}

		const inCorrectGroup = segments[1] === `(${currentRole})`

		if (isSignedIn && !inCorrectGroup) {
			setShouldNavigate(true)
		}
	}, [isLoaded, isSignedIn, user, segments, isCheckingUser])

	useEffect(() => {
		if (shouldNavigate && !isCheckingUser) {
			const currentRole = (user?.publicMetadata.role as string) || 'user'
			router.replace(`/(home)/(${currentRole})`)
		}
	}, [shouldNavigate, isCheckingUser])

	if (!isSignedIn || isCheckingUser) {
		return null
	}

	return <Slot />
}

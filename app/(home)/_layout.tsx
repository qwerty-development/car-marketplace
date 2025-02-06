// app/(home)/_layout.tsx
import React, { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { supabase } from '@/utils/supabase'
import { Alert } from 'react-native'
import { useNotifications } from '@/hooks/useNotifications'


// Add a global state to track if the sign-out process has started
let isSigningOut = false

export { isSigningOut }

export default function HomeLayout() {
	const { isLoaded, isSignedIn } = useAuth()
	const { user } = useUser()
	const router = useRouter()
	const segments = useSegments()
	const [shouldNavigate, setShouldNavigate] = useState(false)
	const [isCheckingUser, setIsCheckingUser] = useState(true)
	const { registerForPushNotifications } = useNotifications()

	// Check/Create Supabase User and Update Last Active
	useEffect(() => {
		const checkAndCreateUser = async () => {
			if (!user || isSigningOut) return

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

				// Update last_active timestamp
				const { error: updateError } = await supabase
					.from('users')
					.update({ last_active: new Date().toISOString() })
					.eq('id', user.id)

				if (updateError) throw updateError
				console.log('Updated last_active for user in Supabase')
				await registerForPushNotifications()
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

// Export a function to set the signing out flag
export function setIsSigningOut(value: boolean) {
	isSigningOut = value
}

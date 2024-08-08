import React, { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useAuth, useUser } from '@clerk/clerk-expo'

export default function HomeLayout() {
	const { isLoaded, isSignedIn } = useAuth()
	const { user } = useUser()
	const router = useRouter()
	const segments = useSegments()

	useEffect(() => {
		if (!isLoaded || !user) return

		let currentRole = 'user'
		if (user.publicMetadata.role) {
			currentRole = user.publicMetadata.role as string
		}

		const inCorrectGroup = segments[1] === `(${currentRole})`

		if (isSignedIn && !inCorrectGroup) {
			router.replace(`/(home)/(${currentRole})`)
		} else if (!isSignedIn) {
			router.replace('/(auth)/sign-in')
		}
	}, [isLoaded, isSignedIn, user, segments])

	// If the user is signed out, we don't want to render the home layout at all
	if (!isSignedIn) {
		return null
	}

	return <Slot />
}

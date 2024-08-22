import React, { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useAuth, useUser } from '@clerk/clerk-expo'

export default function HomeLayout() {
	const { isLoaded, isSignedIn } = useAuth()
	const { user } = useUser()
	const router = useRouter()
	const segments = useSegments()
	const [shouldNavigate, setShouldNavigate] = useState(false)

	useEffect(() => {
		if (!isLoaded || !user) return

		let currentRole = 'user'
		if (user.publicMetadata.role) {
			currentRole = user.publicMetadata.role as string
		}

		const inCorrectGroup = segments[1] === `(${currentRole})`

		if (isSignedIn && !inCorrectGroup) {
			setShouldNavigate(true)
		}
	}, [isLoaded, isSignedIn, user, segments])

	useEffect(() => {
		if (shouldNavigate) {
			const currentRole = (user?.publicMetadata.role as string) || 'user'
			router.replace(`/(home)/(${currentRole})`)
		}
	}, [shouldNavigate])

	if (!isSignedIn) {
		return null
	}

	return <Slot />
}

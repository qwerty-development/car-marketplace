// app/auth/callback.tsx - Alternative OAuth callback route for Android deep linking
import React from 'react';
import { Redirect } from 'expo-router';

export default function AuthCallback() {
  // Redirect to the proper auth callback handler
  return <Redirect href="/(auth)/callback" />;
}

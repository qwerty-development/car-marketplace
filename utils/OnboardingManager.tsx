import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import { AnchorRect, waitForAnchor } from './OnboardingRegistry';
import { useAuth } from './AuthContext';
import { useRouter, useSegments } from 'expo-router';

type Step = {
  id: string;
  title: string;
  description?: string;
  route?: string; // navigate before measuring
};

const STEPS: Step[] = [
  { id: 'intro', title: 'Welcome to Fleet', description: "Let's show you around in a moment." },
  { id: 'home.searchBar', title: 'Search cars', description: 'Use the search bar to find any make, model, year or keyword.' },
  { id: 'home.filterIcon', title: 'Filter results', description: 'Tap filters to refine by price, year, mileage, condition and more.' },
  { id: 'home.category.sports', title: 'Browse categories', description: 'Explore Sports and other categories for quick discovery.' },
  { id: 'global.chatFab', title: 'AI assistant', description: 'Ask Fleet AI for recommendations and comparisons.' },
  { id: 'tab.dealerships', title: 'Dealerships', description: 'Here you can browse all dealerships on Fleet.', route: '/(home)/(user)/(tabs)/dealerships' },
  { id: 'tab.autoclips', title: 'Autoclips', description: 'Open Autoclips from here.' },
  { id: 'autoclips.info', title: 'Autoclips', description: "Fleet special: dealerships post short videos linked to cars. Scroll through lots of clips.", route: '/(home)/(user)/(tabs)/autoclips' },
  { id: 'tab.favorite', title: 'Favorites & Compare', description: 'Find your favorites here. Use Compare to analyze two cars side by side.', route: '/(home)/(user)/(tabs)/Favorite' },
  { id: 'favorite.compare', title: 'Compare cars', description: 'Tap here to compare any 2 cars you saved.' },
];

export default function OnboardingManager() {
  const { profile, updateUserProfile } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Start after splash (home layout shows loader first). Defer a bit.
  useEffect(() => {
    const startTimeout = setTimeout(() => {
      const role = (profile as any)?.role?.toLowerCase?.();
      const shouldRun = role === 'user' && (profile as any)?.onboarded === false;
      if (shouldRun) {
        begin();
      }
    }, 1200);
    return () => clearTimeout(startTimeout);
  }, [profile]);

  const totalSteps = STEPS.length;

  const measureCurrent = async (step: Step) => {
    // Navigate if needed
    if (step.route) {
      try {
        router.replace(step.route as any);
      } catch {}
      // Give navigation time to settle
      await new Promise(r => setTimeout(r, 450));
    }

    if (step.id === 'intro' || step.id === 'autoclips.info') {
      setAnchor(null);
      setVisible(true);
      return;
    }

    // Wait for anchor registration and measure it
    const rect = await waitForAnchor(step.id, { timeoutMs: 5000, intervalMs: 150 });
    setAnchor(rect);
    setVisible(true);
  };

  const begin = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setStepIndex(0);
    await measureCurrent(STEPS[0]);
  };

  const complete = async () => {
    setVisible(false);
    setIsRunning(false);
    try {
      await updateUserProfile({ onboarded: true } as any);
    } catch {}
  };

  const handleNext = async () => {
    const next = stepIndex + 1;
    if (next >= totalSteps) {
      await complete();
      return;
    }
    setVisible(false);
    setStepIndex(next);
    await new Promise(r => setTimeout(r, 150));
    await measureCurrent(STEPS[next]);
  };

  const handleSkip = async () => {
    await complete();
  };

  const current = STEPS[stepIndex];

  return (
    <OnboardingOverlay
      visible={visible}
      anchor={anchor}
      title={current?.title || ''}
      description={current?.description}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onNext={handleNext}
      onSkip={handleSkip}
    />
  );
}



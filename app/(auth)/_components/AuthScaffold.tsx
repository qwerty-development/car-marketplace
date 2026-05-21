import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/utils/ThemeContext';
import { getAuthColors, spacing } from './tokens';
import { Brand, Mono } from './Display';

type Props = {
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  showHeader?: boolean;
  showVersion?: boolean;
  scrollable?: boolean;
  contentContainerStyle?: ViewStyle;
  bottomFooter?: React.ReactNode;
};

const AuthScaffold: React.FC<Props> = ({
  children,
  showBack = false,
  onBack,
  showHeader = true,
  showVersion = true,
  scrollable = true,
  contentContainerStyle,
  bottomFooter,
}) => {
  const { isDarkMode } = useTheme();
  const colors = getAuthColors(isDarkMode);
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    onBack?.();
  };

  const headerNode = showHeader ? (
    <View style={[styles.header, { paddingTop: spacing.sm }]}>
      {showBack ? (
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backButton,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.bgElevated : 'transparent',
            },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
      <Brand tone="primary">Fleet</Brand>
      {showVersion ? (
        <Mono tone="tertiary">v{Constants.expoConfig?.version || '1.0.0'}</Mono>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  ) : null;

  const content = (
    <View style={styles.flex}>
      {headerNode}
      {scrollable ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xl },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentContainerStyle]}>{children}</View>
      )}
      {bottomFooter ? (
        <View
          style={[
            styles.bottomFooter,
            {
              paddingBottom: insets.bottom + spacing.base,
              backgroundColor: colors.bg,
              borderTopColor: colors.border,
            },
          ]}
        >
          {bottomFooter}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  bottomFooter: {
    paddingTop: spacing.base,
    paddingHorizontal: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default AuthScaffold;

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  SafeAreaView,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
  Easing,
  Linking,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useLanguage } from '@/utils/LanguageContext';

const { width } = Dimensions.get('window');

// Section component that renders a collapsible section
const Section = ({ title, children, isLast = false }:any) => {
  const [expanded, setExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedRotate = useRef(new Animated.Value(0)).current;
  const maxHeight = 1000; // Maximum height for animation
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const toggleSection = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);

    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(animatedRotate, {
        toValue,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const rotateInterpolate = animatedRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const contentHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxHeight],
  });

  return (
    <View style={[
      styles.section,
      isLast ? null : styles.sectionBorder,
      { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
    ]}>
      <TouchableOpacity
        onPress={toggleSection}
        style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.sectionTitle,
          { color: isDark ? '#fff' : '#000', textAlign: isRTL ? 'right' : 'left' }
        ]}>
          {title}
        </Text>
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={20}
            color={isDark ? '#D55004' : '#D55004'}
          />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={{ height: contentHeight, overflow: 'hidden' }}>
        <View style={styles.sectionContent}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

// Bullet point component for lists
const Bullet = ({ text }:any) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.bulletContainer}>
      <View style={[
        styles.bulletPoint,
        { backgroundColor: isDark ? '#D55004' : '#D55004' }
      ]} />
      <Text style={[
        styles.bulletText,
        { color: isDark ? '#E5E7EB' : '#4B5563' }
      ]}>
        {text}
      </Text>
    </View>
  );
};

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useRef(new Animated.Value(0)).current;
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Handle contact email link
  const handleEmailPress = () => {
    Linking.openURL('mailto:privacy@fleetapp.me');
  };

  // Handle website link
  const handleWebsitePress = () => {
    Linking.openURL('https://fleetapp.me');
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000' : '#fff', writingDirection: isRTL ? 'rtl' : 'ltr' }
      ]}
    >


      {/* Content */}
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: isDark ? '#D55004' : '#D55004' }]}>
            PRIVACY POLICY
          </Text>
          <View style={styles.headerAccent} />
          <Text style={[styles.lastUpdated, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Last Updated: April 7, 2025
          </Text>
        </View>

        <View style={styles.introContainer}>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            This Privacy Policy describes how Fleet ("we", "our", or "us") collects, uses, and shares your personal information when you use our mobile application ("Service").
          </Text>
        </View>

        <Section title="1. Information We Collect">
          <View style={styles.subSection}>
            <Text style={[styles.subTitle, { color: isDark ? '#D55004' : '#D55004' }]}>
              Personal Information
            </Text>
            <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
              We collect information that you provide directly to us, such as your name, email address, phone number, and profile information when you register for an account.
            </Text>
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.subTitle, { color: isDark ? '#D55004' : '#D55004' }]}>
              Usage Data
            </Text>
            <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
              We collect information about how you interact with our Service, including the pages you visit, features you use, actions you take, and time spent on the Service.
            </Text>
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.subTitle, { color: isDark ? '#D55004' : '#D55004' }]}>
              Device Information
            </Text>
            <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
              We collect information about the device you use to access our Service, including device type, operating system, unique device identifiers, and mobile network information.
            </Text>
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.subTitle, { color: isDark ? '#D55004' : '#D55004' }]}>
              Location Data
            </Text>
            <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
              With your consent, we may collect precise location information to provide location-based services, such as finding nearby dealerships.
            </Text>
          </View>
        </Section>

        <Section title="2. How We Use Your Information">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            We use the information we collect to:
          </Text>
          <Bullet text="Provide, maintain, and improve our Service" />
          <Bullet text="Process transactions and send related information" />
          <Bullet text="Send you technical notices, updates, security alerts, and support messages" />
          <Bullet text="Respond to your comments, questions, and customer service requests" />
          <Bullet text="Develop new products and services" />
          <Bullet text="Generate anonymized, aggregate statistics about how users interact with our Service" />
          <Bullet text="Protect against, identify, and prevent fraud and other illegal activity" />
        </Section>

        <Section title="3. Sharing Your Information">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            We may share your personal information with:
          </Text>
          <Bullet text="Dealerships that you interact with through our Service" />
          <Bullet text="Service providers who perform services on our behalf" />
          <Bullet text="Professional advisors, such as lawyers, auditors, and insurers" />
          <Bullet text="Government bodies when required by law" />
          <Bullet text="In connection with a business transaction, such as a merger or acquisition" />
        </Section>

        <Section title="4. Your Choices">
          <View style={styles.subSection}>
            <Text style={[styles.subTitle, { color: isDark ? '#D55004' : '#D55004' }]}>
              Account Information
            </Text>
            <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
              You can update your account information at any time by logging into your account and modifying your profile settings.
            </Text>
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.subTitle, { color: isDark ? '#D55004' : '#D55004' }]}>
              Location Information
            </Text>
            <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
              You can enable or disable location services when you use our Service through your device settings.
            </Text>
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.subTitle, { color: isDark ? '#D55004' : '#D55004' }]}>
              Push Notifications
            </Text>
            <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
              You can opt out of receiving push notifications through your device settings.
            </Text>
          </View>
        </Section>

        <Section title="5. Data Security">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            We implement appropriate technical and organizational measures to protect the security of your personal information. However, please note that no method of transmission over the Internet or electronic storage is 100% secure.
          </Text>
        </Section>

        <Section title="6. Data Retention">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            We will retain your personal information only for as long as necessary to fulfill the purposes for which it was collected, including to satisfy any legal, accounting, or reporting requirements.
          </Text>
        </Section>

        <Section title="7. Children's Privacy">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            Our Service is not directed to children under the age of 13, and we do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will promptly delete that information.
          </Text>
        </Section>

        <Section title="8. International Data Transfers">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            Your information may be transferred to, and processed in, countries other than the country in which you reside. These countries may have data protection laws that are different from the laws of your country.
          </Text>
        </Section>

        <Section title="9. Changes to This Privacy Policy">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
          </Text>
        </Section>

        <Section title="10. Contact Us" isLast={true}>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            If you have any questions about this Privacy Policy, please contact us:
          </Text>
          <TouchableOpacity onPress={handleEmailPress} style={styles.contactItem}>
            <MaterialIcons name="email" size={18} color="#D55004" />
            <Text style={[styles.contactText, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
              privacy@fleetapp.me
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleWebsitePress} style={styles.contactItem}>
            <MaterialIcons name="language" size={18} color="#D55004" />
            <Text style={[styles.contactText, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
              fleetapp.me
            </Text>
          </TouchableOpacity>
        </Section>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    left: 0,
    right: 0,
    height: 30,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight  : 10,
    left: 16,
    width: 30,
    height: 30,
    borderRadius: 12.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 70,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  headerAccent: {
    width: 40,
    height: 4,
    backgroundColor: '#D55004',
    borderRadius: 2,
    marginBottom: 15,
  },
  lastUpdated: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  introContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionBorder: {
    borderBottomWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  sectionContent: {
    paddingTop: 15,
    paddingBottom: 5,
  },
  subSection: {
    marginBottom: 15,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 15,
  },
  bulletContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingRight: 10,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: 10,
  },
  bulletText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactText: {
    fontSize: 15,
    marginLeft: 10,
  },
});

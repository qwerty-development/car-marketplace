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

const { width } = Dimensions.get('window');

// Section component that renders a collapsible section
const Section = ({ title, children, isLast = false }:any) => {
  const [expanded, setExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedRotate = useRef(new Animated.Value(0)).current;
  const maxHeight = 1000; // Maximum height for animation
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
        style={styles.sectionHeader}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.sectionTitle,
          { color: isDark ? '#fff' : '#000' }
        ]}>
          {title}
        </Text>
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <Ionicons
            name="chevron-forward"
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

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Handle contact email link
  const handleEmailPress = () => {
    Linking.openURL('mailto:support@fleetapp.me');
  };

  // Handle website link
  const handleWebsitePress = () => {
    Linking.openURL('https://fleetapp.me');
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000' : '#fff' }
      ]}
    >

      {/* Floating Header */}
      <Animated.View style={[
        styles.floatingHeader,
        { opacity: headerOpacity,
          backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }
      ]}>
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurView}
        >
          <Text style={[styles.floatingTitle, { color: isDark ? '#fff' : '#000' }]}>
            Terms & Conditions
          </Text>
        </BlurView>
      </Animated.View>

      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[
          styles.backButton,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
        ]}
      >
        <Ionicons name="chevron-back" size={24} color={isDark ? '#fff' : '#000'} />
      </TouchableOpacity>

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
            TERMS & CONDITIONS
          </Text>
          <View style={styles.headerAccent} />
          <Text style={[styles.lastUpdated, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Updated: April 7, 2025
          </Text>
        </View>

        <View style={styles.introContainer}>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            By accessing and placing an order with Fleetapp.me, you confirm that you are in agreement with and bound by the terms of service contained in the Terms & Conditions outlined below. These terms apply to the entire website and any email or other type of communication between you and Fleetapp.me.
          </Text>
        </View>

        <Section title="General Terms">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            Under no circumstances shall Fleetapp.me team be liable for any direct, indirect, special, incidental or consequential damages, including, but not limited to, loss of data or profit, arising out of the use, or the inability to use, the materials on this site, even if Fleetapp.me team or an authorized representative has been advised of the possibility of such damages. If your use of materials from this site results in the need for servicing, repair or correction of equipment or data, you assume any costs thereof.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            Fleetapp.me will not be responsible for any outcome that may occur during the course of usage of our resources. We reserve the rights to change prices and revise the resources usage policy in any moment.
          </Text>
        </Section>

        <Section title="License">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            Fleetapp.me grants you a revocable, non-exclusive, non-transferable, limited license to download, install and use the website/app strictly in accordance with the terms of this Agreement.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            These Terms & Conditions are a contract between you and Fleetapp.me (referred to in these Terms & Conditions as "Fleetapp.me", "us", "we" or "our"), the provider of the Fleetapp.me website and the services accessible from the Fleetapp.me website (which are collectively referred to in these Terms & Conditions as the "Fleetapp.me Service").
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            You are agreeing to be bound by these Terms & Conditions. If you do not agree to these Terms & Conditions, please do not use the Fleetapp.me Service. In these Terms & Conditions, "you" refers both to you as an individual and to the entity you represent. If you violate any of these Terms & Conditions, we reserve the right to cancel your account or block access to your account without notice.
          </Text>
        </Section>

        <Section title="Definitions and Key Terms">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            To help explain things as clearly as possible in this Terms & Conditions, every time any of these terms are referenced, are strictly defined as:
          </Text>
          <Bullet text="Cookie: small amount of data generated by a website and saved by your web browser. It is used to identify your browser, provide analytics, remember information about you such as your language preference or login information." />
          <Bullet text='Company: when this terms mention Company," "we," "us," or "our," it refers to Fleet SARL, (Baabdat, rue 20B), that is responsible for your information under this Terms & Conditions.' />
          <Bullet text="Country: where Fleetapp.me or the owners/founders of Fleetapp.me are based, in this case is Lebanon." />
          <Bullet text="Device: any internet connected device such as a phone, tablet, computer or any other device that can be used to visit Fleetapp.me and use the services." />
          <Bullet text="Service: refers to the service provided by Fleetapp.me as described in the relative terms (if available) and on this platform." />
          <Bullet text="Third-party service: refers to advertisers, contest sponsors, promotional and marketing partners, and others who provide our content or whose products or services we think may interest you." />
          <Bullet text="You: a person or entity that is registered with Fleetapp.me to use the Services." />
        </Section>

        <Section title="Restrictions">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            You agree not to, and you will not permit others to:
          </Text>
          <Bullet text="License, sell, rent, lease, assign, distribute, transmit, host, outsource, disclose or otherwise commercially exploit the website/app or make the platform available to any third party." />
          <Bullet text="Modify, make derivative works of, disassemble, decrypt, reverse compile or reverse engineer any part of the website/app." />
          <Bullet text="Remove, alter or obscure any proprietary notice (including any notice of copyright or trademark) of Fleetapp.me or its affiliates, partners, suppliers or the licensors of the website/app." />
        </Section>

        <Section title="Payment">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            If you register to any of our recurring payment plans, you agree to pay all fees or charges to your account for the Service in accordance with the fees, charges and billing terms in effect at the time that each fee or charge is due and payable.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            Unless otherwise indicated in an order form, you must provide Fleetapp.me with a valid credit card (Visa, MasterCard, or any other issuer accepted by us) ("Payment Provider") as a condition to signing up for the Premium plan. Your Payment Provider agreement governs your use of the designated credit card account, and you must refer to that agreement and not these Terms to determine your rights and liabilities with respect to your Payment Provider.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            By providing Fleetapp.me with your credit card number and associated payment information, you agree that Fleetapp.me is authorized to verify information immediately, and subsequently invoice your account for all fees and charges due and payable to Fleetapp.me hereunder and that no additional notice or consent is required.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            You are responsible for any third-party fees that you may incur when using the Service.
          </Text>
        </Section>

        <Section title="Return and Refund Policy">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            Thanks for shopping at Fleetapp.me. We appreciate the fact that you like to buy the stuff we build. We also want to make sure you have a rewarding experience while you're exploring, evaluating, and purchasing our products.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            As with any shopping experience, there are terms and conditions that apply to transactions at Fleetapp.me. We'll be as brief as our attorneys will allow. The main thing to remember is that by placing an order or making a purchase at Fleetapp.me, you agree to the terms along with Fleetapp.me's Privacy Policy.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            If, for any reason, You are not completely satisfied with any good or service that we provide, don't hesitate to contact us and we will discuss any of the issues you are going through with our product.
          </Text>
        </Section>

        <Section title="Your Suggestions">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            Any feedback, comments, ideas, improvements or suggestions (collectively, "Suggestions") provided by you to Fleetapp.me with respect to the website/app shall remain the sole and exclusive property of Fleetapp.me. Fleetapp.me shall be free to use, copy, modify, publish, or redistribute the Suggestions for any purpose and in any way without any credit or any compensation to you.
          </Text>
        </Section>

        <Section title="Your Consent">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            We've updated our Terms & Conditions to provide you with complete transparency into what is being set when you visit our site and how it's being used. By using our website/app, registering an account, or making a purchase, you hereby consent to our Terms & Conditions.
          </Text>
        </Section>

        <Section title="Links to Other Websites">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            This Terms & Conditions applies only to the Services. The Services may contain links to other websites not operated or controlled by Fleetapp.me. We are not responsible for the content, accuracy or opinions expressed in such websites, and such websites are not investigated, monitored or checked for accuracy or completeness by us. Please remember that when you use a link to go from the Services to another website, our Terms & Conditions are no longer in effect. Your browsing and interaction on any other website, including those that have a link on our platform, is subject to that website's own rules and policies. Such third parties may use their own cookies or other methods to collect information about you.
          </Text>
        </Section>

        <Section title="Cookies">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            Fleetapp.me uses "Cookies" to identify the areas of our website/app that you have visited. A Cookie is a small piece of data stored on your computer or mobile device by your web browser. We use Cookies to enhance the performance and functionality of our website/app but are non-essential to their use. However, without these cookies, certain functionality like videos may become unavailable or you would be required to enter your login details every time you visit the website/app as we would not be able to remember that you had logged in previously. Most web browsers can be set to disable the use of Cookies. However, if you disable Cookies, you may not be able to access functionality on our website/app correctly or at all. We never place Personally Identifiable Information in Cookies.
          </Text>
        </Section>

        <Section title="Changes to Our Terms & Conditions">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            You acknowledge and agree that Fleetapp.me may stop (permanently or temporarily) providing the Service (or any features within the Service) to you or to users generally at Fleetapp.me's sole discretion, without prior notice to you. You may stop using the Service at any time. You do not need to specifically inform Fleetapp.me when you stop using the Service.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            If we decide to change our Terms & Conditions, we will post those changes on this page, and/or update the Terms & Conditions modification date below.
          </Text>
        </Section>

        <Section title="Term and Termination">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            This Agreement shall remain in effect until terminated by you or Fleetapp.me.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            Fleetapp.me may, in its sole discretion, at any time and for any or no reason, suspend or terminate this Agreement with or without prior notice.
          </Text>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            This Agreement will terminate immediately, without prior notice from Fleetapp.me, in the event that you fail to comply with any provision of this Agreement. You may also terminate this Agreement by deleting the website/app and all copies thereof from your computer.
          </Text>
        </Section>

        <Section title="Intellectual Property">
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563', marginBottom: 0 }]}>
            The website/app and its entire contents, features and functionality (including but not limited to all information, software, text, displays, images, video and audio, and the design, selection and arrangement thereof), are owned by Fleetapp.me, its licensors or other providers of such material and are protected by Lebanon and international copyright, trademark, patent, trade secret and other intellectual property or proprietary rights laws. The material may not be copied, modified, reproduced, downloaded or distributed in any way, in whole or in part, without the express prior written permission of Fleetapp.me, unless and except as is expressly provided in these Terms & Conditions. Any unauthorized use of the material is prohibited.
          </Text>
        </Section>

        <Section title="Contact Us" isLast={true}>
          <Text style={[styles.paragraph, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
            Don't hesitate to contact us if you have any questions:
          </Text>
          <TouchableOpacity onPress={handleEmailPress} style={styles.contactItem}>
            <MaterialIcons name="email" size={18} color="#D55004" />
            <Text style={[styles.contactText, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
              support@fleetapp.me
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('tel:+96176875775')} style={styles.contactItem}>
            <MaterialIcons name="phone" size={18} color="#D55004" />
            <Text style={[styles.contactText, { color: isDark ? '#E5E7EB' : '#4B5563' }]}>
              +96176875775
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
    </View>
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
    top: Platform.OS === 'android' ? StatusBar!.currentHeight  : 10,
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
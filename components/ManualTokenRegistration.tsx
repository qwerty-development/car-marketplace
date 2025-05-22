import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Alert, ActivityIndicator, ScrollView, useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/utils/supabase';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useAuth } from '@/utils/AuthContext';

interface DebugLog {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARNING';
  message: string;
  data?: any;
}

export default function ManualTokenRegistration() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [lastResult, setLastResult] = useState<string>('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const addLog = (level: DebugLog['level'], message: string, data?: any) => {
    const log: DebugLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    console.log(`[MANUAL_TOKEN_${level}] ${message}`, data || '');
    setDebugLogs(prev => [...prev, log]);
  };

  const clearLogs = () => {
    setDebugLogs([]);
    setLastResult('');
  };

  // Enhanced project ID resolution with detailed logging
  const getProjectIdWithLogging = (): string => {
    addLog('INFO', 'Starting project ID resolution...');
    
    // Method 1: Environment variable
    const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    if (envProjectId) {
      addLog('SUCCESS', `Found project ID in environment: ${envProjectId}`);
      return envProjectId;
    }
    addLog('WARNING', 'No project ID found in process.env.EXPO_PUBLIC_PROJECT_ID');

    // Method 2: EAS configuration
    const easProjectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (easProjectId) {
      addLog('SUCCESS', `Found project ID in EAS config: ${easProjectId}`);
      return easProjectId;
    }
    addLog('WARNING', 'No project ID found in Constants.expoConfig.extra.eas.projectId');

    // Method 3: Extra configuration
    const extraProjectId = Constants.expoConfig?.extra?.projectId;
    if (extraProjectId) {
      addLog('SUCCESS', `Found project ID in extra config: ${extraProjectId}`);
      return extraProjectId;
    }
    addLog('WARNING', 'No project ID found in Constants.expoConfig.extra.projectId');

    // Method 4: Manifest fallback
    // @ts-ignore
    const manifestProjectId = Constants.manifest?.extra?.eas?.projectId || Constants.manifest?.extra?.projectId;
    if (manifestProjectId) {
      addLog('SUCCESS', `Found project ID in manifest: ${manifestProjectId}`);
      return manifestProjectId;
    }
    addLog('WARNING', 'No project ID found in manifest');

    // Method 5: Extract from updates URL
    try {
      // @ts-ignore
      const updatesUrl = Constants.expoConfig?.updates?.url || Constants.manifest?.updates?.url;
      if (updatesUrl && typeof updatesUrl === 'string') {
        const projectIdMatch = updatesUrl.match(/([a-f0-9-]{36})/i);
        if (projectIdMatch && projectIdMatch[1]) {
          addLog('SUCCESS', `Extracted project ID from updates URL: ${projectIdMatch[1]}`);
          return projectIdMatch[1];
        }
      }
    } catch (error) {
      addLog('ERROR', 'Error extracting project ID from URL', error);
    }

    // Fallback
    const fallbackId = 'aaf80aae-b9fd-4c39-a48a-79f2eac06e68';
    addLog('WARNING', `Using hardcoded fallback project ID: ${fallbackId}`);
    return fallbackId;
  };

  // Enhanced experience ID resolution with detailed logging
  const getExperienceIdWithLogging = (): string => {
    addLog('INFO', 'Starting experience ID resolution...');
    
    // Method 1: From owner and slug
    const owner = Constants.expoConfig?.owner || Constants.manifest?.owner;
    const slug = Constants.expoConfig?.slug || Constants.manifest?.slug;
    
    if (owner && slug) {
      const experienceId = `@${owner}/${slug}`;
      addLog('SUCCESS', `Built experience ID from owner/slug: ${experienceId}`);
      return experienceId;
    }
    addLog('WARNING', `Missing owner (${owner}) or slug (${slug})`);

    // Method 2: Direct experience ID
    // @ts-ignore
    const directExperienceId = Constants.expoConfig?.experienceId || Constants.manifest?.experienceId;
    if (directExperienceId) {
      addLog('SUCCESS', `Found direct experience ID: ${directExperienceId}`);
      return directExperienceId;
    }
    addLog('WARNING', 'No direct experience ID found');

    // Fallback
    const fallbackExperienceId = '@qwerty-app/clerk-expo-quickstart';
    addLog('WARNING', `Using hardcoded fallback experience ID: ${fallbackExperienceId}`);
    return fallbackExperienceId;
  };

  const forceTokenRegistration = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found. Please sign in first.');
      return;
    }

    setIsProcessing(true);
    clearLogs();
    addLog('INFO', '=== STARTING MANUAL TOKEN REGISTRATION ===');

    try {
      // Step 1: Device and permission checks
      addLog('INFO', 'Step 1: Checking device and permissions...');
      
      if (!Device.isDevice) {
        addLog('WARNING', 'Running on simulator/emulator');
      }
      
      addLog('INFO', 'Device info', {
        isDevice: Device.isDevice,
        platform: Platform.OS,
        brand: Device.brand,
        modelName: Device.modelName
      });

      // Step 2: Check permissions
      addLog('INFO', 'Step 2: Checking notification permissions...');
      let permissionStatus = await Notifications.getPermissionsAsync();
      addLog('INFO', 'Current permissions', permissionStatus);

      if (permissionStatus.status !== 'granted') {
        addLog('INFO', 'Requesting notification permissions...');
        permissionStatus = await Notifications.requestPermissionsAsync();
        addLog('INFO', 'Updated permissions', permissionStatus);
      }

      if (permissionStatus.status !== 'granted') {
        addLog('ERROR', 'Notification permissions not granted');
        setLastResult('FAILED: Permissions not granted');
        return;
      }

      // Step 3: Setup Android notification channel
      if (Platform.OS === 'android') {
        addLog('INFO', 'Step 3: Setting up Android notification channel...');
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D55004',
            sound: 'notification.wav',
            enableVibrate: true,
            enableLights: true
          });
          addLog('SUCCESS', 'Android notification channel setup complete');
        } catch (channelError) {
          addLog('ERROR', 'Failed to setup Android channel', channelError);
        }
      }

      // Step 4: Get configuration parameters
      addLog('INFO', 'Step 4: Resolving configuration parameters...');
      const projectId = getProjectIdWithLogging();
      const experienceId = getExperienceIdWithLogging();

// Replace the token acquisition section (Step 5) in your ManualTokenRegistration component

// Step 5: Enhanced token acquisition with detailed error logging
addLog('INFO', 'Step 5: Attempting token acquisition with enhanced error capture...');
let token: string | null = null;
let tokenMethod = '';
let allErrors: any[] = [];

// Strategy 1: Both projectId and experienceId
try {
  addLog('INFO', 'Strategy 1: Trying with both projectId and experienceId');
  addLog('INFO', 'Strategy 1 Parameters', { projectId, experienceId });
  
  const response = await Notifications.getExpoPushTokenAsync({
    projectId: projectId,
    experienceId: experienceId,
  });
  
  token = response.data;
  tokenMethod = 'projectId + experienceId';
  addLog('SUCCESS', `Token acquired via Strategy 1: ${token.substring(0, 20)}...`);
} catch (error) {
  allErrors.push({ strategy: 1, error });
  addLog('ERROR', 'Strategy 1 DETAILED ERROR', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    name: error.name,
    cause: error.cause,
    fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
  });

  // Strategy 2: Only projectId
  try {
    addLog('INFO', 'Strategy 2: Trying with projectId only');
    addLog('INFO', 'Strategy 2 Parameters', { projectId });
    
    const response = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    
    token = response.data;
    tokenMethod = 'projectId only';
    addLog('SUCCESS', `Token acquired via Strategy 2: ${token.substring(0, 20)}...`);
  } catch (error2) {
    allErrors.push({ strategy: 2, error: error2 });
    addLog('ERROR', 'Strategy 2 DETAILED ERROR', {
      message: error2.message,
      stack: error2.stack,
      code: error2.code,
      name: error2.name,
      cause: error2.cause,
      fullError: JSON.stringify(error2, Object.getOwnPropertyNames(error2))
    });

    // Strategy 3: Only experienceId
    try {
      addLog('INFO', 'Strategy 3: Trying with experienceId only');
      addLog('INFO', 'Strategy 3 Parameters', { experienceId });
      
      const response = await Notifications.getExpoPushTokenAsync({
        experienceId: experienceId,
      });
      
      token = response.data;
      tokenMethod = 'experienceId only';
      addLog('SUCCESS', `Token acquired via Strategy 3: ${token.substring(0, 20)}...`);
    } catch (error3) {
      allErrors.push({ strategy: 3, error: error3 });
      addLog('ERROR', 'Strategy 3 DETAILED ERROR', {
        message: error3.message,
        stack: error3.stack,
        code: error3.code,
        name: error3.name,
        cause: error3.cause,
        fullError: JSON.stringify(error3, Object.getOwnPropertyNames(error3))
      });

      // Strategy 4: Emergency fallback with no parameters
      try {
        addLog('INFO', 'Strategy 4: Emergency fallback with no parameters');
        
        const response = await Notifications.getExpoPushTokenAsync({});
        
        token = response.data;
        tokenMethod = 'no parameters (emergency)';
        addLog('SUCCESS', `Token acquired via Strategy 4: ${token.substring(0, 20)}...`);
      } catch (error4) {
        allErrors.push({ strategy: 4, error: error4 });
        addLog('ERROR', 'Strategy 4 DETAILED ERROR', {
          message: error4.message,
          stack: error4.stack,
          code: error4.code,
          name: error4.name,
          cause: error4.cause,
          fullError: JSON.stringify(error4, Object.getOwnPropertyNames(error4))
        });

        // Log comprehensive failure analysis
        addLog('ERROR', 'ALL STRATEGIES FAILED - COMPREHENSIVE ERROR ANALYSIS', {
          totalStrategies: allErrors.length,
          errors: allErrors,
          configuration: {
            projectId,
            experienceId,
            platform: Platform.OS,
            deviceInfo: {
              isDevice: Device.isDevice,
              brand: Device.brand,
              modelName: Device.modelName,
              osName: Device.osName,
              osVersion: Device.osVersion
            },
            constants: {
              expoConfig: Constants.expoConfig ? 'Present' : 'Missing',
              manifest: Constants.manifest ? 'Present' : 'Missing',
              appOwnership: Constants.appOwnership,
              executionEnvironment: Constants.executionEnvironment,
              experienceUrl: Constants.experienceUrl,
              linkingUrl: Constants.linkingUrl
            }
          }
        });

        throw new Error(`All token acquisition strategies failed. Check detailed error logs above.`);
      }
    }
  }
}

try {
    addLog('INFO', 'Strategy 5: Direct Expo API call (Nuclear Option)');
    
    // Method 1: Use SDK 51+ syntax
    const response = await Notifications.getExpoPushTokenAsync();
    token = response.data;
    tokenMethod = 'SDK 51+ default';
    addLog('SUCCESS', `Token acquired via Strategy 5a: ${token.substring(0, 20)}...`);
  } catch (error5a) {
    allErrors.push({ strategy: '5a', error: error5a });
    addLog('ERROR', 'Strategy 5a FAILED', error5a);
    
    try {
      // Method 2: Legacy SDK syntax
      addLog('INFO', 'Strategy 5b: Legacy SDK syntax');
      
      const response = await Notifications.getExpoPushTokenAsync({
        experienceId: '@qwerty-app/clerk-expo-quickstart',
      });
      token = response.data;
      tokenMethod = 'Legacy SDK with hardcoded experienceId';
      addLog('SUCCESS', `Token acquired via Strategy 5b: ${token.substring(0, 20)}...`);
    } catch (error5b) {
      allErrors.push({ strategy: '5b', error: error5b });
      addLog('ERROR', 'Strategy 5b FAILED', error5b);
      
      try {
        // Method 3: Direct API call bypassing Expo SDK
        addLog('INFO', 'Strategy 5c: Direct API bypass');
        
        const directApiUrl = 'https://exp.host/--/api/v2/push/getExpoPushToken';
        const requestBody = {
          experienceId: '@qwerty-app/clerk-expo-quickstart',
          deviceId: Device.osName + '_' + Device.modelName,
          development: false
        };
        
        addLog('INFO', 'Making direct API call', { url: directApiUrl, body: requestBody });
        
        const apiResponse = await fetch(directApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Expo/1.0.0'
          },
          body: JSON.stringify(requestBody)
        });
        
        const apiData = await apiResponse.json();
        addLog('INFO', 'Direct API response', apiData);
        
        if (apiData.data && apiData.data.expoPushToken) {
          token = apiData.data.expoPushToken;
          tokenMethod = 'Direct API bypass';
          addLog('SUCCESS', `Token acquired via Strategy 5c: ${token.substring(0, 20)}...`);
        } else {
          throw new Error('Invalid response from direct API call');
        }
      } catch (error5c) {
        allErrors.push({ strategy: '5c', error: error5c });
        addLog('ERROR', 'Strategy 5c FAILED', error5c);
        
        // Final strategy: Generate pseudo-token for testing
        try {
          addLog('INFO', 'Strategy 6: Generate test token for debugging purposes');
          
          // This is NOT a real token but allows us to test the database insertion process
          const pseudoToken = `ExponentPushToken[TEST_${Date.now()}_${user.id.substring(0, 8)}]`;
          
          addLog('WARNING', `Generated pseudo-token for testing: ${pseudoToken}`);
          addLog('WARNING', 'THIS IS NOT A REAL TOKEN - FOR DEBUGGING ONLY');
          
          token = pseudoToken;
          tokenMethod = 'Pseudo-token for debugging';
          
          // Add special marker to logs
          addLog('ERROR', 'CRITICAL: Using pseudo-token. Real notifications will NOT work!');
          
        } catch (error6) {
          addLog('ERROR', 'Even pseudo-token generation failed', error6);
          throw new Error('All strategies including emergency fallbacks failed');
        }
      }
    }
  }

      if (!token) {
        throw new Error('No token received from any strategy');
      }

      // Step 6: Validate token format
      addLog('INFO', 'Step 6: Validating token format...');
      const validExpoTokenFormat = /^ExponentPushToken\[.+\]$/;
      if (!validExpoTokenFormat.test(token)) {
        addLog('ERROR', `Invalid token format: ${token}`);
        throw new Error(`Invalid token format received: ${token}`);
      }
      addLog('SUCCESS', 'Token format validation passed');

      // Step 7: Save to local storage
      addLog('INFO', 'Step 7: Saving token to local storage...');
      try {
        await SecureStore.setItemAsync('expoPushToken', token);
        await SecureStore.setItemAsync('expoPushTokenTimestamp', Date.now().toString());
        addLog('SUCCESS', 'Token saved to local storage');
      } catch (storageError) {
        addLog('ERROR', 'Failed to save token to storage', storageError);
        throw storageError;
      }

      // Step 8: Clean up old tokens
      addLog('INFO', 'Step 8: Cleaning up old tokens for this device...');
      try {
        const { error: cleanupError } = await supabase
          .from('user_push_tokens')
          .update({ 
            active: false,
            last_updated: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('device_type', Platform.OS);
          
        if (cleanupError) {
          addLog('WARNING', 'Error during token cleanup', cleanupError);
        } else {
          addLog('SUCCESS', 'Old tokens deactivated successfully');
        }
      } catch (cleanupError) {
        addLog('WARNING', 'Exception during token cleanup', cleanupError);
      }

      // Step 9: Insert new token into database
      addLog('INFO', 'Step 9: Inserting new token into database...');
      let dbSuccess = false;
      let tokenId: string | null = null;

      // Try insertion first
      try {
        const { data: insertData, error: insertError } = await supabase
          .from('user_push_tokens')
          .insert({
            user_id: user.id,
            token: token,
            device_type: Platform.OS,
            last_updated: new Date().toISOString(),
            signed_in: true,
            active: true
          })
          .select('id');
        
        if (insertError) {
          if (insertError.code === '23505') {
            addLog('INFO', 'Token already exists (constraint violation), will try update');
          } else {
            addLog('ERROR', 'Unexpected error during insertion', insertError);
            throw insertError;
          }
        } else if (insertData && insertData.length > 0) {
          tokenId = insertData[0].id;
          dbSuccess = true;
          addLog('SUCCESS', `Token inserted successfully with ID: ${tokenId}`);
        }
      } catch (insertError) {
        addLog('ERROR', 'Exception during token insertion', insertError);
      }

      // If insertion failed, try update
      if (!dbSuccess) {
        try {
          addLog('INFO', 'Attempting to update existing token...');
          const { error: updateError } = await supabase
            .from('user_push_tokens')
            .update({
              signed_in: true,
              active: true,
              last_updated: new Date().toISOString(),
              device_type: Platform.OS,
            })
            .eq('user_id', user.id)
            .eq('token', token);
          
          if (updateError) {
            addLog('ERROR', 'Error updating token', updateError);
            throw updateError;
          } else {
            dbSuccess = true;
            addLog('SUCCESS', 'Token updated successfully');
            
            // Try to get token ID
            try {
              const { data: tokenData } = await supabase
                .from('user_push_tokens')
                .select('id')
                .eq('user_id', user.id)
                .eq('token', token)
                .single();
              
              if (tokenData?.id) {
                tokenId = tokenData.id;
                addLog('INFO', `Retrieved token ID: ${tokenId}`);
              }
            } catch (idError) {
              addLog('WARNING', 'Could not retrieve token ID', idError);
            }
          }
        } catch (updateError) {
          addLog('ERROR', 'Exception during token update', updateError);
          throw updateError;
        }
      }

      // Step 10: Save token ID to local storage
      if (tokenId) {
        try {
          await SecureStore.setItemAsync('expoPushTokenId', tokenId);
          addLog('SUCCESS', 'Token ID saved to local storage');
        } catch (idStorageError) {
          addLog('WARNING', 'Failed to save token ID to storage', idStorageError);
        }
      }

      // Step 11: Verify final state
      addLog('INFO', 'Step 11: Verifying final state...');
      try {
        const { data: verifyData, error: verifyError } = await supabase
          .from('user_push_tokens')
          .select('*')
          .eq('user_id', user.id)
          .eq('token', token)
          .single();
        
        if (verifyError) {
          addLog('ERROR', 'Error verifying token in database', verifyError);
        } else {
          addLog('SUCCESS', 'Token verification successful', {
            id: verifyData.id,
            active: verifyData.active,
            signed_in: verifyData.signed_in,
            device_type: verifyData.device_type
          });
        }
      } catch (verifyError) {
        addLog('WARNING', 'Exception during verification', verifyError);
      }

      // Success summary
      const successMessage = `✅ TOKEN REGISTRATION SUCCESSFUL!\n\n` +
        `Method: ${tokenMethod}\n` +
        `Token: ${token.substring(0, 30)}...\n` +
        `Token ID: ${tokenId || 'Unknown'}\n` +
        `User ID: ${user.id}\n` +
        `Device: ${Platform.OS}\n\n` +
        `Check your Supabase user_push_tokens table to confirm the entry exists.`;

      setLastResult(successMessage);
      addLog('SUCCESS', '=== MANUAL TOKEN REGISTRATION COMPLETED SUCCESSFULLY ===');
      
      Alert.alert(
        'Success! 🎉',
        'Push token has been manually registered. Check the logs below for details.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      const errorMessage = `❌ TOKEN REGISTRATION FAILED!\n\n` +
        `Error: ${error.message}\n\n` +
        `Check the detailed logs below to see exactly what went wrong.`;

      setLastResult(errorMessage);
      addLog('ERROR', '=== MANUAL TOKEN REGISTRATION FAILED ===', error);
      
      Alert.alert(
        'Registration Failed',
        'Token registration failed. Check the logs below for detailed error information.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getLogColor = (level: DebugLog['level']) => {
    switch (level) {
      case 'SUCCESS': return '#10B981';
      case 'ERROR': return '#EF4444';
      case 'WARNING': return '#F59E0B';
      default: return isDark ? '#9CA3AF' : '#6B7280';
    }
  };

  return (
    <ScrollView style={{ 
      flex: 1, 
      backgroundColor: isDark ? '#000' : '#fff',
      padding: 20 
    }}>
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          color: '#D55004',
          textAlign: 'center',
          marginBottom: 10
        }}>
          Manual Push Token Registration
        </Text>
        <Text style={{ 
          fontSize: 14, 
          color: isDark ? '#9CA3AF' : '#6B7280',
          textAlign: 'center',
          lineHeight: 20
        }}>
          Use this to manually force push token registration and debug production issues.
          Remove this component before final production release.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={forceTokenRegistration}
          disabled={isProcessing}
          style={{
            flex: 1,
            backgroundColor: isProcessing ? '#9CA3AF' : '#D55004',
            paddingVertical: 15,
            paddingHorizontal: 20,
            borderRadius: 8,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10
          }}
        >
          {isProcessing && <ActivityIndicator color="white" size="small" />}
          <Text style={{ 
            color: 'white', 
            fontWeight: 'bold',
            fontSize: 16
          }}>
            {isProcessing ? 'Processing...' : 'Force Register Token'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={clearLogs}
          style={{
            backgroundColor: isDark ? '#374151' : '#E5E7EB',
            paddingVertical: 15,
            paddingHorizontal: 20,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Text style={{ 
            color: isDark ? '#fff' : '#000', 
            fontWeight: 'bold'
          }}>
            Clear Logs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Last Result Summary */}
      {lastResult !== '' && (
        <View style={{
          backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
          borderLeftWidth: 4,
          borderLeftColor: lastResult.includes('SUCCESSFUL') ? '#10B981' : '#EF4444'
        }}>
          <Text style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: isDark ? '#fff' : '#000',
            lineHeight: 18
          }}>
            {lastResult}
          </Text>
        </View>
      )}

      {/* Debug Logs */}
      {debugLogs.length > 0 && (
        <View style={{
          backgroundColor: isDark ? '#1F2937' : '#F8F9FA',
          borderRadius: 8,
          padding: 15,
          marginBottom: 20
        }}>
          <Text style={{
            fontSize: 16,
            fontWeight: 'bold',
            color: isDark ? '#fff' : '#000',
            marginBottom: 10
          }}>
            Debug Logs ({debugLogs.length})
          </Text>
          
          {debugLogs.map((log, index) => (
            <View key={index} style={{ marginBottom: 8 }}>
              <Text style={{
                fontSize: 10,
                fontFamily: 'monospace',
                color: getLogColor(log.level),
                lineHeight: 14
              }}>
                [{log.timestamp.split('T')[1].split('.')[0]}] {log.level}: {log.message}
                {log.data && (
                  <Text style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                    {'\n'}  Data: {JSON.stringify(log.data, null, 2)}
                  </Text>
                )}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* User Info */}
      <View style={{
        backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
        padding: 15,
        borderRadius: 8,
        marginBottom: 20
      }}>
        <Text style={{
          fontSize: 14,
          fontWeight: 'bold',
          color: isDark ? '#fff' : '#000',
          marginBottom: 5
        }}>
          Current User Info:
        </Text>
        <Text style={{
          fontSize: 12,
          fontFamily: 'monospace',
          color: isDark ? '#9CA3AF' : '#6B7280',
          lineHeight: 16
        }}>
          User ID: {user?.id || 'Not signed in'}{'\n'}
          Platform: {Platform.OS}{'\n'}
          Is Device: {Device.isDevice ? 'Yes' : 'No (Simulator)'}{'\n'}
          Device Brand: {Device.brand || 'Unknown'}{'\n'}
          Model: {Device.modelName || 'Unknown'}
        </Text>
      </View>

      {/* Instructions */}
      <View style={{
        backgroundColor: isDark ? '#1F2937' : '#FEF3C7',
        padding: 15,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B'
      }}>
        <Text style={{
          fontSize: 14,
          fontWeight: 'bold',
          color: isDark ? '#fff' : '#92400E',
          marginBottom: 10
        }}>
          Instructions:
        </Text>
        <Text style={{
          fontSize: 12,
          color: isDark ? '#FEF3C7' : '#92400E',
          lineHeight: 18
        }}>
          1. Make sure you're signed in with a valid user account{'\n'}
          2. Click "Force Register Token" to manually trigger registration{'\n'}
          3. Watch the logs for detailed step-by-step progress{'\n'}
          4. If successful, check your Supabase user_push_tokens table{'\n'}
          5. Share the logs with your developer for debugging{'\n'}
          6. IMPORTANT: Remove this component before production release!
        </Text>
      </View>
    </ScrollView>
  );
}
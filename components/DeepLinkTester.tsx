// components/DeepLinkTester.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';

const DeepLinkTester = () => {
  const [linkUrl, setLinkUrl] = useState('https://www.fleetapp.me/cars/1');
  const [linkType, setLinkType] = useState('web');
  const [lastTestedLink, setLastTestedLink] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    setLogs(prevLogs => [`[${timestamp}] ${message}`, ...prevLogs.slice(0, 19)]);
  };

  const buildLink = () => {
    const baseUrl = linkType === 'app' ? 'fleet://cars/' : 'https://www.fleetapp.me/cars/';
    const id = linkUrl.split('/').pop();
    return linkType === 'app' ? `fleet://cars/${id}` : `https://www.fleetapp.me/cars/${id}`;
  };

  const testLink = async () => {
    try {
      const url = buildLink();
      setLastTestedLink(url);
      addLog(`Opening URL: ${url}`);

      const supported = await Linking.canOpenURL(url);

      if (supported) {
        addLog(`URL can be opened by the system`);
        await Linking.openURL(url);
        addLog(`URL opened successfully`);
      } else {
        addLog(`URL cannot be opened by the system`);
        Alert.alert(
          'Error',
          `Cannot open URL: ${url}. Make sure the URL scheme is registered.`
        );
      }
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      Alert.alert('Error', `Failed to open link: ${error}`);
    }
  };

  const copyLink = async () => {
    const url = buildLink();
    await Clipboard.setStringAsync(url);
    addLog(`Copied to clipboard: ${url}`);
    Alert.alert('Copied', `Link copied to clipboard: ${url}`);
  };

  const presetLinks = [
    { label: 'Car ID 1', url: 'https://www.fleetapp.me/cars/1' },
    { label: 'Car ID 2', url: 'https://www.fleetapp.me/cars/2' },
    { label: 'App Scheme', url: 'fleet://cars/1', type: 'app' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Deep Link Tester</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={linkUrl}
          onChangeText={setLinkUrl}
          placeholder="Enter link URL"
        />

        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, linkType === 'web' && styles.activeType]}
            onPress={() => setLinkType('web')}
          >
            <Text style={styles.typeText}>Web URL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeButton, linkType === 'app' && styles.activeType]}
            onPress={() => setLinkType('app')}
          >
            <Text style={styles.typeText}>App Scheme</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testLink}>
          <Text style={styles.buttonText}>Test Link</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={copyLink}>
          <Text style={styles.buttonText}>Copy Link</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Preset Links</Text>
      <ScrollView horizontal style={styles.presetContainer}>
        {presetLinks.map((preset, index) => (
          <TouchableOpacity
            key={index}
            style={styles.presetButton}
            onPress={() => {
              setLinkUrl(preset.url);
              if (preset.type) setLinkType(preset.type as 'web' | 'app');
            }}
          >
            <Text style={styles.presetText}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {lastTestedLink && (
        <View style={styles.lastTestedContainer}>
          <Text style={styles.lastTestedLabel}>Last Tested:</Text>
          <Text style={styles.lastTestedUrl}>{lastTestedLink}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Logs</Text>
      <ScrollView style={styles.logContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    marginTop: 8,
  },
  typeButton: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  activeType: {
    backgroundColor: '#D55004',
    borderColor: '#D55004',
  },
  typeText: {
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginVertical: 16,
  },
  button: {
    flex: 1,
    backgroundColor: '#D55004',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: '#333',
    marginRight: 0,
    marginLeft: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  presetContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  presetButton: {
    backgroundColor: '#eee',
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  presetText: {
    fontWeight: '500',
  },
  lastTestedContainer: {
    backgroundColor: '#eaeaea',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  lastTestedLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  lastTestedUrl: {
    fontSize: 14,
    color: '#333',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  logText: {
    color: '#eee',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});

export default DeepLinkTester;
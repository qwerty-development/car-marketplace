import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';

interface AIResponseCardProps {
  message: string;
  carCount?: number;
  isLoading?: boolean;
}

export default function AIResponseCard({ 
  message, 
  carCount = 0, 
  isLoading = false,
}: AIResponseCardProps) {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = getStyles(isDarkMode);

  // Parse the message for better formatting
  const formatMessage = (text: string) => {
    // Split by common patterns and format
    const lines = text.split('\n').filter(line => line.trim());
    const sections: { type: 'text' | 'list' | 'highlight'; content: string[] }[] = [];
    
    let currentSection: { type: 'text' | 'list' | 'highlight'; content: string[] } = { type: 'text', content: [] };
    
    lines.forEach(line => {
      let trimmedLine = line.trim();

      // Strip markdown bold (**text**)
      trimmedLine = trimmedLine.replace(/\*\*/g, '');
 
      // Detect list items (starts with number, bullet, or dash)
      if (/^(\d+\.|\*|\-|•)/.test(trimmedLine)) {
        if (currentSection.type !== 'list') {
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
          currentSection = { type: 'list', content: [] };
        }
        currentSection.content.push(trimmedLine);
      }
      // Detect highlights (contains certain keywords)
      else if (trimmedLine.toLowerCase().includes('recommend') || 
               trimmedLine.toLowerCase().includes('perfect') ||
               trimmedLine.toLowerCase().includes('ideal')) {
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
        }
        sections.push({ type: 'highlight', content: [trimmedLine] });
        currentSection = { type: 'text', content: [] };
      }
      // Regular text
      else {
        if (currentSection.type !== 'text') {
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
          currentSection = { type: 'text', content: [] };
        }
        currentSection.content.push(trimmedLine);
      }
    });
    
    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }
    
    return sections.length > 0 ? sections : [{ type: 'text', content: [text.replace(/\*\*/g, '')] }];
  };

  // Remove markdown bold markers for display
  const sanitizedMessage = message.replace(/\*\*/g, '');

  const messagePreview = sanitizedMessage.split('\n')[0].slice(0, 120);
  const shouldShowExpand = message.length > 120 || message.includes('\n');
  const displayMessage = isExpanded ? sanitizedMessage : messagePreview;
  const formattedSections = formatMessage(displayMessage);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.aiIconContainer}>
            <MaterialCommunityIcons name="robot" size={20} color="#fff" />
          </View>
          <Text style={styles.aiLabel}>AI Assistant</Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </View>
        <Text style={styles.loadingText}>Finding the perfect cars for you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* AI Header */}
      <View style={styles.header}>
        <View style={styles.aiIconContainer}>
          <MaterialCommunityIcons name="robot" size={20} color="#fff" />
        </View>
        <Text style={styles.aiLabel}>AI Assistant</Text>
        {carCount > 0 && (
          <View style={styles.resultsBadge}>
            <Text style={styles.resultsText}>{carCount} cars found</Text>
          </View>
        )}
      </View>

      {/* Message Content */}
      <View style={styles.messageContainer}>
        {formattedSections.map((section, index) => (
          <View key={index} style={styles.section}>
            {section.type === 'highlight' ? (
              <View style={styles.highlightContainer}>
                <Ionicons name="bulb" size={16} color={isDarkMode ? '#FFB385' : '#D55004'} />
                <Text style={styles.highlightText}>{section.content.join(' ')}</Text>
              </View>
            ) : section.type === 'list' ? (
              <View style={styles.listContainer}>
                {section.content.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.listItem}>
                    <View style={styles.bulletPoint} />
                    <Text style={styles.listText}>{item.replace(/^(\d+\.)?(\*|\-|•)?\s*/, '')}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.messageText}>{section.content.join(' ')}</Text>
            )}
          </View>
        ))}

        {/* Expand/Collapse Button */}
        {shouldShowExpand && (
          <TouchableOpacity 
            style={styles.expandButton}
            onPress={() => setIsExpanded(!isExpanded)}
          >
            <Text style={styles.expandText}>
              {isExpanded ? 'Show less' : 'Read more...'}
            </Text>
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={isDarkMode ? '#FFB385' : '#D55004'} 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Removed action buttons */}
    </View>
  );
}

const getStyles = (isDarkMode: boolean) => StyleSheet.create({
  card: {
    backgroundColor: isDarkMode ? '#232323' : '#fff',
    borderRadius: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: isDarkMode ? '#000' : '#000',
    shadowOpacity: isDarkMode ? 0.25 : 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: isDarkMode ? 1 : 0,
    borderColor: isDarkMode ? '#333' : undefined,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? '#333' : '#e9ecef',
  },
  aiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDarkMode ? '#D55004' : '#D55004',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  aiLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: isDarkMode ? '#fff' : '#333',
    flex: 1,
  },
  resultsBadge: {
    backgroundColor: isDarkMode ? '#FFB385' : '#D55004',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: isDarkMode ? '#FFB385' : '#D55004',
    marginHorizontal: 2,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  loadingText: {
    fontSize: 16,
    color: isDarkMode ? '#ccc' : '#666',
    padding: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  messageContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    color: isDarkMode ? '#e0e0e0' : '#333',
  },
  highlightContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDarkMode ? 'rgba(255, 179, 133, 0.1)' : 'rgba(213, 80, 4, 0.05)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: isDarkMode ? '#FFB385' : '#D55004',
  },
  highlightText: {
    fontSize: 16,
    fontWeight: '500',
    color: isDarkMode ? '#FFB385' : '#D55004',
    marginLeft: 8,
    flex: 1,
    lineHeight: 22,
  },
  listContainer: {
    marginLeft: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: isDarkMode ? '#FFB385' : '#D55004',
    marginTop: 9,
    marginRight: 12,
  },
  listText: {
    fontSize: 15,
    lineHeight: 22,
    color: isDarkMode ? '#e0e0e0' : '#333',
    flex: 1,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  expandText: {
    fontSize: 14,
    color: isDarkMode ? '#FFB385' : '#D55004',
    fontWeight: '500',
    marginRight: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? '#333' : '#e9ecef',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: isDarkMode ? '#333' : '#fff',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: isDarkMode ? '#444' : '#e0e0e0',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: isDarkMode ? '#FFB385' : '#D55004',
    marginLeft: 6,
  },
}); 
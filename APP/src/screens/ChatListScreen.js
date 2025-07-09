import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const ChatListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Get API URL from constants
  const getApiUrl = () => {
    // Use Constants.expoConfig.extra.apiUrl if configured in app.config.js
    if (Constants.expoConfig?.extra?.apiUrl) {
      return Constants.expoConfig.extra.apiUrl;
    }
    
    // Default fallbacks based on environment
    const isDev = process.env.NODE_ENV === 'development' || __DEV__;
    
    // For local development on actual device, use your computer's local IP instead of localhost
    const devServerIp = Constants.expoConfig?.extra?.devServerIp || "192.168.1.2";
    return isDev ? `http://${devServerIp}:5000/api` : 'https://smiya.onrender.com/api';
  };

  const API_URL = getApiUrl();

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      setLoading(true);
      setError('');

      if (!user || !user.token) {
        setError('Authentication error. Please login again.');
        setLoading(false);
        return;
      }

      // Get list of chats with last messages
      const response = await axios.get(`${API_URL}/messages/chats`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      setChats(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to load chats. Please try again.');
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChats();
    setRefreshing(false);
  };

  const goToChat = (chat) => {
    navigation.navigate('ChatDetail', { 
      friendId: chat.userId, 
      friendName: chat.username 
    });
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    const today = new Date();
    
    // If message is from today, show just the time
    if (messageDate.toDateString() === today.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If message is from this year, show month and day
    if (messageDate.getFullYear() === today.getFullYear()) {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show full date
    return messageDate.toLocaleDateString();
  };

  const getLastMessagePreview = (message) => {
    if (!message) return 'Start a conversation';
    
    if (message.content) {
      return message.content.length > 30 
        ? message.content.substring(0, 27) + '...' 
        : message.content;
    } else if (message.image) {
      return '🖼️ Photo';
    } else {
      return 'New message';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchChats}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      
      <View style={styles.content}>
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
        ) : chats.length > 0 ? (
          <FlatList
            data={chats}
            keyExtractor={(item) => item.userId.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.chatCard}
                onPress={() => goToChat(item)}
              >
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.chatInfo}>
                  <View style={styles.chatHeader}>
                    <Text style={styles.username}>{item.username}</Text>
                    {item.lastMessage && (
                      <Text style={styles.timestamp}>
                        {formatTimestamp(item.lastMessage.timestamp)}
                      </Text>
                    )}
                  </View>
                  <Text style={[
                    styles.lastMessage,
                    item.lastMessage && !item.lastMessage.read && item.lastMessage.senderId !== user.id
                      ? styles.unreadMessage 
                      : null
                  ]}>
                    {item.lastMessage && item.lastMessage.senderId === user.id && (
                      <Text style={styles.youPrefix}>You: </Text>
                    )}
                    {getLastMessagePreview(item.lastMessage)}
                  </Text>
                </View>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#6366f1']}
              />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={60} color="#6366f1" />
            <Text style={styles.emptyText}>No conversations yet.</Text>
            <Text style={styles.emptySubtext}>Start chatting with your friends!</Text>
            <TouchableOpacity 
              style={styles.findFriendsButton}
              onPress={() => navigation.navigate('Friends')}
            >
              <Text style={styles.findFriendsButtonText}>Find Friends</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#6366f1',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  chatCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  timestamp: {
    color: '#999',
    fontSize: 12,
  },
  lastMessage: {
    color: '#666',
    fontSize: 14,
  },
  unreadMessage: {
    fontWeight: 'bold',
    color: '#333',
  },
  youPrefix: {
    color: '#888',
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: '#6366f1',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  emptySubtext: {
    marginTop: 5,
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  findFriendsButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 10,
  },
  findFriendsButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loader: {
    marginTop: 20,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    marginTop: 15,
    marginHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#c62828',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default ChatListScreen;

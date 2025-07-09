import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
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
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      setError('');

      if (!user || !user.token) {
        setError('Authentication error. Please login again.');
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/friends`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      setFriends(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching friends:', err);
      setError('Failed to load friends. Please try again.');
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  };

  const goToChat = (friend) => {
    navigation.navigate('ChatDetail', { 
      friendId: friend.id, 
      friendName: friend.username 
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
        <Text style={styles.welcomeText}>
          Welcome, {user?.username || 'User'}!
        </Text>
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchFriends}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Recent Chats</Text>
        
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
        ) : friends.length > 0 ? (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.friendCard}
                onPress={() => goToChat(item)}
              >
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{item.username}</Text>
                  <Text style={styles.lastMessage}>
                    Tap to start chatting
                  </Text>
                </View>
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
            <Text style={styles.emptyText}>No friends yet. Add some friends to start chatting!</Text>
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
    marginBottom: 5,
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  friendCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
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
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  lastMessage: {
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
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

export default HomeScreen;

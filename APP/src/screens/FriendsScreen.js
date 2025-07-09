import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const FriendsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('friends');
  
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

  const fetchFriends = useCallback(async () => {
    try {
      if (!user || !user.token) {
        setError('Authentication error. Please login again.');
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/friends`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      setFriends(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching friends:', err);
      setError('Failed to load friends. Please try again.');
    }
  }, [API_URL, user]);

  const fetchFriendRequests = useCallback(async () => {
    try {
      if (!user || !user.token) return;

      const response = await axios.get(`${API_URL}/friends/requests`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      setFriendRequests(response.data);
    } catch (err) {
      console.error('Error fetching friend requests:', err);
      // No need to set error here as the primary data is friends
    }
  }, [API_URL, user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchFriends(), fetchFriendRequests()]);
    setLoading(false);
  }, [fetchFriends, fetchFriendRequests]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearchUser = async () => {
    if (!searchTerm.trim()) {
      Alert.alert('Error', 'Please enter a username or email to search');
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/users/search?q=${searchTerm}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      if (response.data.length === 0) {
        Alert.alert('Not Found', 'No users found with that username or email');
      } else {
        // Show search results
        Alert.alert(
          'Search Results',
          `${response.data.length} user(s) found. Would you like to send a friend request?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Send Request',
              onPress: () => sendFriendRequest(response.data[0].id),
            },
          ]
        );
      }
    } catch (err) {
      console.error('Error searching users:', err);
      Alert.alert('Error', 'Failed to search for users. Please try again.');
    }
  };

  const sendFriendRequest = async (targetUserId) => {
    try {
      await axios.post(
        `${API_URL}/friends/requests`,
        { targetUserId },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      Alert.alert('Success', 'Friend request sent successfully');
      setSearchTerm('');
    } catch (err) {
      console.error('Error sending friend request:', err);
      Alert.alert(
        'Error',
        err.response?.data?.error || 'Failed to send friend request'
      );
    }
  };

  const acceptFriendRequest = async (requestId) => {
    try {
      await axios.put(
        `${API_URL}/friends/requests/${requestId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      Alert.alert('Success', 'Friend request accepted');
      
      // Refresh both lists
      await Promise.all([fetchFriends(), fetchFriendRequests()]);
    } catch (err) {
      console.error('Error accepting friend request:', err);
      Alert.alert(
        'Error',
        err.response?.data?.error || 'Failed to accept friend request'
      );
    }
  };

  const rejectFriendRequest = async (requestId) => {
    try {
      await axios.put(
        `${API_URL}/friends/requests/${requestId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${user.token}` } }
      );

      Alert.alert('Success', 'Friend request rejected');
      
      // Refresh requests list
      await fetchFriendRequests();
    } catch (err) {
      console.error('Error rejecting friend request:', err);
      Alert.alert(
        'Error',
        err.response?.data?.error || 'Failed to reject friend request'
      );
    }
  };

  const goToChat = (friend) => {
    navigation.navigate('ChatDetail', { 
      friendId: friend.id, 
      friendName: friend.username 
    });
  };

  const renderFriendItem = ({ item }) => (
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
        <Text style={styles.friendEmail}>{item.email}</Text>
      </View>
      <TouchableOpacity 
        style={styles.chatButton}
        onPress={() => goToChat(item)}
      >
        <Ionicons name="chatbubble-outline" size={20} color="#6366f1" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRequestItem = ({ item }) => (
    <View style={styles.requestCard}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {item.senderUsername.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.senderUsername}</Text>
        <Text style={styles.friendEmail}>
          Sent you a friend request
        </Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity 
          style={[styles.requestButton, styles.acceptButton]}
          onPress={() => acceptFriendRequest(item.id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.requestButton, styles.rejectButton]}
          onPress={() => rejectFriendRequest(item.id)}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or email"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={handleSearchUser}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Text 
            style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}
          >
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text 
            style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}
          >
            Requests 
            {friendRequests.length > 0 && (
              <Text style={styles.badgeText}> ({friendRequests.length})</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#6366f1" style={styles.loader} />
      ) : (
        activeTab === 'friends' ? (
          friends.length > 0 ? (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderFriendItem}
              contentContainerStyle={styles.listContent}
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
              <Text style={styles.emptyText}>No friends yet. Search to add new friends!</Text>
            </View>
          )
        ) : (
          friendRequests.length > 0 ? (
            <FlatList
              data={friendRequests}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderRequestItem}
              contentContainerStyle={styles.listContent}
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
              <Text style={styles.emptyText}>No pending friend requests</Text>
            </View>
          )
        )
      )}
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
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    paddingBottom: 5,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginTop: 10,
  },
  tab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6366f1',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#6366f1',
    fontWeight: 'bold',
  },
  badgeText: {
    color: '#e53935',
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 20,
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
    marginBottom: 3,
  },
  friendEmail: {
    color: '#666',
    fontSize: 14,
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestCard: {
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
  requestActions: {
    flexDirection: 'row',
  },
  requestButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginLeft: 5,
  },
  acceptButton: {
    backgroundColor: '#6366f1',
  },
  rejectButton: {
    backgroundColor: '#f0f0f0',
  },
  acceptButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 12,
  },
  rejectButtonText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 12,
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
    marginHorizontal: 15,
    marginTop: 10,
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

export default FriendsScreen;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  StyleSheet,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useCall } from '../contexts/CallContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';
import Constants from 'expo-constants';

const ChatScreen = ({ route, navigation }) => {
  const { friendId, friendName } = route.params;
  const { user } = useAuth();
  const { socket } = useSocket();
  const { initiateCall } = useCall();
  
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const flatListRef = useRef();
  const hasJoinedRoom = useRef(false);
  
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
  const MESSAGES_PER_PAGE = 20;
  
  // Fetch chat messages
  const fetchChatHistory = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const response = await axios.get(
        `${API_URL}/messages/${friendId}?page=${pageNum}&limit=${MESSAGES_PER_PAGE}`,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      
      const fetchedMessages = response.data.messages || response.data;
      
      // No more messages to load
      if (fetchedMessages.length < MESSAGES_PER_PAGE) {
        setHasMore(false);
      }
      
      if (append) {
        setMessages(prevMessages => [...fetchedMessages, ...prevMessages]);
      } else {
        setMessages(fetchedMessages);
        // Scroll to bottom after initial load
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 300);
      }
      
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [API_URL, friendId, user]);
  
  useEffect(() => {
    fetchChatHistory(1, false);
  }, [fetchChatHistory]);
  
  // Handle socket connection for real-time messaging
  useEffect(() => {
    if (!socket || !friendId) return;
    
    // Join chat room
    const roomId = [user.id, parseInt(friendId)].sort().join('-');
    
    setSocketConnected(socket.connected);
    
    const handleConnect = () => {
      console.log('Socket connected in chat component');
      setSocketConnected(true);
      
      // Only join room if we haven't already
      if (!hasJoinedRoom.current) {
        socket.emit('join-room', roomId);
        console.log(`Joined chat room: ${roomId}`);
        hasJoinedRoom.current = true;
      }
    };
    
    const handleDisconnect = () => {
      console.log('Socket disconnected in chat component');
      setSocketConnected(false);
      hasJoinedRoom.current = false;
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // If already connected, join room immediately
    if (socket.connected) {
      handleConnect();
    }
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      hasJoinedRoom.current = false;
    };
  }, [socket, friendId, user.id]);
  
  // Listen for new messages
  useEffect(() => {
    if (!socket) return;
    
    const handleNewMessage = (message) => {
      console.log('New message received:', message);
      
      // Add the new message to the state
      setMessages(prevMessages => {
        // Check if the message already exists
        if (prevMessages.some(m => m.id === message.id)) {
          return prevMessages;
        }
        
        const updatedMessages = [...prevMessages, message];
        
        // Scroll to bottom after receiving a new message
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
        
        return updatedMessages;
      });
    };
    
    socket.on('new-message', handleNewMessage);
    
    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [socket]);
  
  const sendMessage = async () => {
    if ((!messageInput || messageInput.trim() === '') && !image) return;
    
    try {
      let messageData = {
        content: messageInput.trim(),
        receiverId: parseInt(friendId),
        senderId: user.id,
      };
      
      if (image) {
        setUploading(true);
        
        // Create form data for image upload
        const formData = new FormData();
        formData.append('media', {
          uri: image,
          type: 'image/jpeg',
          name: 'photo.jpg'
        });
        
        // Upload the image
        const uploadResponse = await axios.post(
          `${API_URL}/messages/upload`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${user.token}`
            }
          }
        );
        
        // Add the media URL to the message
        if (uploadResponse.data && uploadResponse.data.mediaUrl) {
          messageData.mediaUrl = uploadResponse.data.mediaUrl;
          messageData.mediaType = 'image';
        }
        
        setUploading(false);
        setImage(null);
      }
      
      // Send the message
      const response = await axios.post(
        `${API_URL}/messages`,
        messageData,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      
      // Clear input
      setMessageInput('');
      
      // Scroll to bottom
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
    } catch (err) {
      console.error('Error sending message:', err);
      setUploading(false);
    }
  };
  
  const handlePickImage = async () => {
    // Request permission to access the photo library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access photos is required!');
      return;
    }
    
    // Launch the image picker
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      // Resize the image to reduce upload size
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      setImage(manipResult.uri);
    }
  };
  
  const handleTakePhoto = async () => {
    // Request permission to access the camera
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access camera is required!');
      return;
    }
    
    // Launch the camera
    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      // Resize the image to reduce upload size
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      setImage(manipResult.uri);
    }
  };
  
  const startVideoCall = async () => {
    if (!socketConnected) {
      alert('Not connected to server. Please wait and try again.');
      return;
    }
    
    const success = await initiateCall(parseInt(friendId), friendName);
    if (!success) {
      alert('Failed to start video call. Please try again later.');
    }
  };
  
  const renderMessage = ({ item }) => {
    const isCurrentUser = item.senderId === user.id;
    const messageTime = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.sentMessage : styles.receivedMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isCurrentUser ? styles.sentBubble : styles.receivedBubble
        ]}>
          {item.mediaUrl && (
            <Image 
              source={{ uri: item.mediaUrl }} 
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}
          
          {item.content && item.content.trim() !== '' && (
            <Text style={[
              styles.messageText,
              isCurrentUser ? styles.sentText : styles.receivedText
            ]}>
              {item.content}
            </Text>
          )}
          
          <Text style={styles.messageTime}>{messageTime}</Text>
        </View>
      </View>
    );
  };
  
  const loadMoreMessages = () => {
    if (hasMore && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchChatHistory(nextPage, true);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>{friendName}</Text>
        
        <TouchableOpacity
          style={styles.callButton}
          onPress={startVideoCall}
          disabled={!socketConnected}
        >
          <Ionicons name="videocam" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onEndReachedThreshold={0.1}
          inverted={false}
          ListHeaderComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#6366f1" style={styles.loadingMore} />
            ) : null
          }
          onEndReached={loadMoreMessages}
        />
      )}
      
      {image && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: image }} style={styles.imagePreview} />
          <TouchableOpacity 
            style={styles.cancelImageButton}
            onPress={() => setImage(null)}
          >
            <Ionicons name="close-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.mediaButton} 
          onPress={handlePickImage}
          disabled={uploading}
        >
          <Ionicons name="image" size={24} color="#6366f1" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.mediaButton} 
          onPress={handleTakePhoto}
          disabled={uploading}
        >
          <Ionicons name="camera" size={24} color="#6366f1" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={messageInput}
          onChangeText={setMessageInput}
          multiline
          editable={!uploading}
        />
        
        <TouchableOpacity 
          style={[styles.sendButton, (!messageInput && !image) || uploading ? styles.disabledButton : null]}
          onPress={sendMessage}
          disabled={(!messageInput && !image) || uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      
      {!socketConnected && (
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineText}>
            ⚠️ Connection lost. Messages may not be delivered immediately.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  callButton: {
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 15,
    paddingBottom: 20,
  },
  loadingMore: {
    marginVertical: 10,
  },
  messageContainer: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  sentMessage: {
    justifyContent: 'flex-end',
  },
  receivedMessage: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sentBubble: {
    backgroundColor: '#6366f1',
    borderTopRightRadius: 2,
  },
  receivedBubble: {
    backgroundColor: '#e9e9e9',
    borderTopLeftRadius: 2,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 5,
  },
  sentText: {
    color: '#fff',
  },
  receivedText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-end',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 5,
  },
  imagePreviewContainer: {
    padding: 10,
    backgroundColor: '#ddd',
    position: 'relative',
  },
  imagePreview: {
    height: 100,
    width: 100,
    borderRadius: 8,
  },
  cancelImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  mediaButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#6366f1',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#a9a9a9',
  },
  offlineContainer: {
    backgroundColor: '#ffcc0033',
    padding: 8,
    alignItems: 'center',
    position: 'absolute',
    top: 85,
    left: 0,
    right: 0,
  },
  offlineText: {
    color: '#cc7000',
    fontSize: 12,
    textAlign: 'center',
  }
});

export default ChatScreen;

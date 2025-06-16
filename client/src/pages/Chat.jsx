import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getCurrentUser } from '../services/authService';
import { useCall } from '../contexts/CallContext';
import MediaUpload from '../components/MediaUpload';
import MediaDisplay from '../components/MediaDisplay';
import '../styles/Chat.css';

function Chat() {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const { socket } = useCall(); // Get socket from context
  
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [friendInfo, setFriendInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showConnectionWarning, setShowConnectionWarning] = useState(false);
  const [initialConnecting, setInitialConnecting] = useState(true);
  const [isScrollLocked, setIsScrollLocked] = useState(false); // New state for scroll locking
  const [showMediaUpload, setShowMediaUpload] = useState(false); // New state for media upload

  const socketRef = useRef(socket);
  const hasJoinedRoom = useRef(false);
  
  const messagesContainerRef = useRef(null);
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const MESSAGES_PER_PAGE = 20;
  
  // Modified function to fetch chat history with pagination
  const fetchChatHistory = useCallback(async (pageNum = 1, append = false) => {
    try {
      // Lock scrolling while loading messages
      setIsScrollLocked(true);
      
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.token) return;

      const response = await axios.get(
        `${API_URL}/messages/${friendId}?page=${pageNum}&limit=${MESSAGES_PER_PAGE}`, 
        {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        }
      );
      
      // Get messages from response
      const fetchedMessages = response.data.messages || response.data;
      
      if (fetchedMessages.length < MESSAGES_PER_PAGE) {
        setHasMore(false);
      }
      
      // For pagination: add NEW messages at BEGINNING of array (older messages)
      if (append) {
        // Save current scroll height before adding new messages
        const prevHeight = messagesContainerRef.current?.scrollHeight || 0;
        
        setMessages(prev => {
          const prevIds = new Set(prev.map(msg => msg.id));
          const uniqueNewMessages = fetchedMessages.filter(msg => !prevIds.has(msg.id));
          return [...uniqueNewMessages, ...prev]; // Prepend older messages
        });
        
        // After adding new messages, adjust scroll position
        setTimeout(() => {
          if (messagesContainerRef.current && fetchedMessages.length > 0) {
            // Calculate height of new content and set scroll position
            const newTotalHeight = messagesContainerRef.current.scrollHeight;
            const addedHeight = newTotalHeight - prevHeight;
            messagesContainerRef.current.scrollTop = addedHeight;
          }
          setIsScrollLocked(false);
        }, 100);
      } else {
        // First load - just set messages
        setMessages(fetchedMessages);
        
        // For initial load, scroll to bottom after a brief delay
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
          setIsScrollLocked(false);
        }, 100);
      }
      
      setLoading(false);
      setLoadingMore(false);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setLoading(false);
      setLoadingMore(false);
      setError('Could not load chat history');
      setIsScrollLocked(false);
    }
  }, [API_URL, friendId]);
  
  // Fetch friend information
  const fetchFriendInfo = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      
      if (!currentUser || !currentUser.token) {
        console.error("No valid user token found");
        setError("Authentication error. Please login again.");
        navigate('/login');
        return;
      }
      
      console.log(`Fetching friend info for ID: ${friendId}`);
      
      // Only try the friends endpoint
      const friendsResponse = await axios.get(`${API_URL}/friends`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      const friend = friendsResponse.data.find(f => f.id === parseInt(friendId, 10));
      
      if (friend) {
        console.log("Found friend in friends list:", friend);
        setFriendInfo(friend);
      } else {
        throw new Error("Friend not found");
      }
    } catch (err) {
      console.error('Error fetching friend info:', err);
      setError('Could not load friend information. Please go back and try again.');
    }
  }, [API_URL, friendId, navigate]);
  
  // Initial load - fetch friend info and most recent messages
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
      navigate('/login');
      return;
    }
    
    setPage(1);
    setHasMore(true);
    setLoading(true);
    setMessages([]);
    
    fetchFriendInfo();
    fetchChatHistory(1, false);
    
  }, [friendId, fetchFriendInfo, fetchChatHistory, navigate]);
  
  // Modified scroll handler to load older messages when scrolling to top
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || isScrollLocked) return;
    
    const { scrollTop } = messagesContainerRef.current;
    
    // When user scrolls to TOP, load older messages
    if (scrollTop < 50 && !loadingMore && hasMore) {
      setLoadingMore(true);
      
      // Load next page of messages
      const nextPage = page + 1;
      setPage(nextPage);
      
      fetchChatHistory(nextPage, true);
    }
  }, [fetchChatHistory, hasMore, loadingMore, page, isScrollLocked]);
  
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);
  
  // Socket connection management
  useEffect(() => {
    // Update socket ref
    socketRef.current = socket;
    
    if (!socket || !friendId) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const roomId = [currentUser.id, friendId].sort().join('-');
    
    // Set initial connection state
    setSocketConnected(socket.connected);
    
    const handleConnect = () => {
      console.log("Socket connected in Chat component");
      setSocketConnected(true);
      setInitialConnecting(false);
      
      // Only join room if we haven't already
      if (!hasJoinedRoom.current) {
        console.log(`Joining chat room: ${roomId}`);
        socket.emit('join-room', roomId);
        hasJoinedRoom.current = true;
      }
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected in Chat component");
      setSocketConnected(false);
      hasJoinedRoom.current = false; // Reset flag on disconnect
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // Call handleConnect immediately if already connected
    if (socket.connected) {
      handleConnect();
    }
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      hasJoinedRoom.current = false;
    };
  }, [socket, friendId]);
  
  // Listen for new messages - modified to add at end of array
  useEffect(() => {
    if (!socket) return;
    
    const handleNewMessage = (message) => {
      console.log('New message received:', message);
      const currentUser = getCurrentUser();
      if (!currentUser) return;
      
      // Only add message if it belongs to current conversation
      if (
        (message.senderId === parseInt(friendId) && message.receiverId === currentUser.id) || 
        (message.senderId === currentUser.id && message.receiverId === parseInt(friendId))
      ) {
        // Add new message to the END of the array (newest at the end)
        setMessages(prev => [...prev, message]);
        
        // Scroll to bottom when new message arrives
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        }, 100);
      }
    };
    
    socket.on('new-message', handleNewMessage);
    
    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [friendId, socket]);
  
  // Warning display code
  useEffect(() => {
    let warningTimer;
    
    // Only show warning if we're not in initial connecting phase
    if (!socketConnected && !initialConnecting) {
      // Add delay before showing the warning to allow time for connection
      warningTimer = setTimeout(() => {
        setShowConnectionWarning(true);
      }, 2000); // 2 second delay
    } else {
      setShowConnectionWarning(false);
      
      // If we connected for the first time, no longer in initial connecting phase
      if (socketConnected) {
        setInitialConnecting(false);
      }
    }
    
    return () => {
      if (warningTimer) clearTimeout(warningTimer);
    };
  }, [socketConnected, initialConnecting]);

  // Send message function - updated to scroll to bottom after sending
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
      setError('You need to be logged in');
      return;
    }
    
    if (!socketConnected) {
      console.warn('Socket disconnected, message delivery may be delayed');
      // Show a temporary warning but continue sending (the HTTP request will still work)
      setError('Connection issue. Message will be sent when connection is restored.');
      setTimeout(() => setError(''), 3000);
    }
    
    try {
      const newMessage = {
        content: messageInput,
        receiverId: friendId,
        senderId: currentUser.id
      };
      
      await axios.post(`${API_URL}/messages`, newMessage, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Clear input after sending
      setMessageInput('');
      
      // After sending, scroll to bottom
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 300);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    }
  };

  // New function to handle media upload success
  const handleMediaUploadSuccess = async (mediaData) => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.token) {
        setError('You need to be logged in');
        return;
      }
      
      const mediaMessage = {
        mediaUrl: mediaData.url,
        mediaType: mediaData.resourceType,
        publicId: mediaData.publicId,
        format: mediaData.format,
        receiverId: friendId
      };
      
      await axios.post(`${API_URL}/messages/media`, mediaMessage, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Hide media upload component after successful upload
      setShowMediaUpload(false);
      
      // Scroll to bottom after sending
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 300);
    } catch (err) {
      console.error('Error sending media message:', err);
      setError('Failed to send media');
    }
  };


  // Modified message rendering to include media display
  const renderMessage = (message) => {
    const isCurrentUser = message.senderId === getCurrentUser()?.id;
  
    
    // Check for missing media properties
    if (message.mediaUrl === undefined && message.hasMedia) {
      console.error('Message marked as having media but URL is missing:', message);
    }
    
    return (
      <div 
        key={message.id} 
        className={`message ${isCurrentUser ? 'sent' : 'received'}`}
      >
        {/* Show message content if any */}
        {message.content && (
          <div className="message-content">{message.content}</div>
        )}
        
        {/* Improved media detection logic */}
        {(message.mediaUrl || (message.hasMedia && !message.mediaUrl)) && (
          <MediaDisplay 
            media={{
              url: message.mediaUrl || '',
              resourceType: message.mediaType || 'image', 
              publicId: message.mediaPublicId || '',
              format: message.mediaFormat || '',
              messageId: message.id
            }}
          />
        )}
        
        <div className="message-time">
          {new Date(message.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    );
  };

  // Helper function for Chat.jsx
  // const getFormatFromUrl = (url) => {
  //   if (!url) return '';
  //   const parts = url.split('.');
  //   return parts.length > 1 ? parts[parts.length - 1].split('?')[0] : '';
  // };

  // Update navigation to use existing RandomVideoCall
  const startRandomVideoCall = async () => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.token) {
        setError('You need to be logged in');
        return;
      }

      // Generate a random room ID
      const roomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Navigate to random video call (remove /videocall reference)
      navigate(`/random-videocall/${roomId}`, {
        state: {
          isHost: true,
          friendInfo: friendInfo,
          roomId: roomId
        }
      });
    } catch (err) {
      console.error('Error starting random video call:', err);
      setError('Failed to start video call');
    }
  };

  // Add this function to share the video call link
  const shareVideoCallLink = async () => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.token) {
        setError('You need to be logged in');
        return;
      }

      const roomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const videoCallLink = `${window.location.origin}/videocall/${roomId}`;
      
      // Send the link as a message
      const linkMessage = {
        content: `Join my video call: ${videoCallLink}`,
        receiverId: friendId,
        senderId: currentUser.id,
        messageType: 'video_call_link'
      };
      
      await axios.post(`${API_URL}/messages`, linkMessage, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Clear input and scroll to bottom
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 300);
      
      // Also navigate to the call
      navigate(`/videocall/${roomId}`, {
        state: {
          isHost: true,
          friendInfo: friendInfo,
          roomId: roomId
        }
      });
    } catch (err) {
      console.error('Error sharing video call link:', err);
      setError('Failed to share video call link');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button className="back-button" onClick={() => navigate('/friends')}>
          ← Back
        </button>
        <h2>
          {friendInfo ? (
            friendInfo.username || 
            (friendInfo.user && friendInfo.user.username) || 
            'Friend'
          ) : 'Loading...'}
        </h2>
        {/* Add video call buttons */}
        <div className="chat-actions">
          <button 
            className="video-call-btn" 
            onClick={startRandomVideoCall}
            title="Start Video Call"
          >
            📹 Video Call
          </button>
          <button 
            className="share-call-btn" 
            onClick={shareVideoCallLink}
            title="Share Video Call Link"
          >
            🔗 Share Call
          </button>
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {showConnectionWarning && !socketConnected && (
        <div className="connection-warning" style={{
          backgroundColor: "#fff3cd", 
          color: "#856404", 
          padding: "8px 12px", 
          borderRadius: "4px",
          margin: "8px 0",
          textAlign: "center"
        }}>
          ⚠️ Connection lost. Messages may not be delivered immediately.
        </div>
      )}
      
      <div 
        className="messages-container" 
        ref={messagesContainerRef}
        style={{ pointerEvents: isScrollLocked ? 'none' : 'auto' }}
      >
        {loadingMore && (
          <div className="loading-more-messages" style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '10px 15px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            zIndex: 5
          }}>
            <div className="spinner"></div>
            Loading more messages...
          </div>
        )}
        
        {!hasMore && messages.length > 0 && (
          <div className="no-more-messages">Beginning of conversation</div>
        )}
        
        {loading && !loadingMore ? (
          <div className="loading-messages">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start a conversation!</div>
        ) : (
          messages.map(renderMessage)
        )}
      </div>
      
      {/* Media upload component */}
      {showMediaUpload && (
        <MediaUpload 
          onUploadSuccess={handleMediaUploadSuccess}
          onCancel={() => setShowMediaUpload(false)}
        />
      )}
      
      <form className="message-form" onSubmit={sendMessage}>
        <button 
          type="button" 
          className="media-button"
          onClick={() => setShowMediaUpload(!showMediaUpload)}
        >
          {showMediaUpload ? '✕' : '+'}
        </button>
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading || isScrollLocked}
        />
        <button type="submit" disabled={!messageInput.trim() || loading || isScrollLocked}>
          Send
        </button>
      </form>
    </div>
  );
}

export default Chat;
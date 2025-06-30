import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getCurrentUser } from '../services/authService';
import { useCall } from '../contexts/CallContext';
import MediaUpload from '../components/MediaUpload';
import MediaDisplay from '../components/MediaDisplay';
// Add emoji picker import
import EmojiPicker from 'emoji-picker-react';
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

  // New state for reply and reactions
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactionMessage, setActiveReactionMessage] = useState(null);

  const socketRef = useRef(socket);
  const hasJoinedRoom = useRef(false);
  
  const messagesContainerRef = useRef(null);
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const MESSAGES_PER_PAGE = 20;
  
  // Add a preprocessMessage function to prepare media properly before rendering
  const preprocessMessage = useCallback((message) => {
    if (!message) return message;
    
    // Create a processed copy of the message
    const processedMessage = {...message};
    
    // If message has media, ensure it's properly formatted for immediate loading
    if (processedMessage.mediaUrl) {
      // Add a timestamp to the message to force proper loading
      processedMessage.mediaTimestamp = Date.now();
      
      // Ensure media type is set correctly
      if (!processedMessage.mediaType) {
        // Try to infer media type from URL or format
        const url = processedMessage.mediaUrl.toLowerCase();
        if (url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)($|\?)/)) {
          processedMessage.mediaType = 'image';
        } else if (url.match(/\.(mp4|webm|mov|avi|flv|wmv|mkv)($|\?)/)) {
          processedMessage.mediaType = 'video';
        } else if (url.match(/\.(mp3|wav|ogg|aac|flac)($|\?)/)) {
          processedMessage.mediaType = 'audio';
        } else {
          // Default to image if we can't determine
          processedMessage.mediaType = 'image';
        }
      }
    }
    
    return processedMessage;
  }, []);
  
  // Preprocess messages before setting to state - defined before it's used in fetchChatHistory
  const processMessages = useCallback((messages) => {
    return messages.map(preprocessMessage);
  }, [preprocessMessage]);
  
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
      
      // Debug log for reactions and replies
      console.log("Fetched messages:", fetchedMessages);
      fetchedMessages.forEach(msg => {
        if (msg.replyToId) console.log(`Message ${msg.id} is replying to ${msg.replyToId}`);
        if (msg.reactions && msg.reactions.length > 0) console.log(`Message ${msg.id} has ${msg.reactions.length} reactions`);
      });
      
      if (fetchedMessages.length < MESSAGES_PER_PAGE) {
        setHasMore(false);
      }
      
      // Process messages to ensure media is properly formatted for immediate loading
      const processedMessages = processMessages(fetchedMessages);
      
      // For pagination: add NEW messages at BEGINNING of array (older messages)
      if (append) {
        // We can remove the unused scroll position tracking variables
        // and just update the messages directly
        
        setMessages(prev => {
          const prevIds = new Set(prev.map(msg => msg.id));
          const uniqueNewMessages = processedMessages.filter(msg => !prevIds.has(msg.id));
          return [...uniqueNewMessages, ...prev]; // Prepend older messages
        });
        
        // After adding new messages, adjust scroll position and ensure scroll lock is released
        setTimeout(() => {
          // Unlock scrolling after ensuring messages are rendered
          setIsScrollLocked(false);
        }, 300); // Increased timeout to ensure rendering completes
      } else {
        // First load - set processed messages
        setMessages(processedMessages);
        
        // For initial load, scroll to bottom after a brief delay
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
          // Unlock scrolling after ensuring messages are rendered
          setIsScrollLocked(false);
        }, 300); // Increased timeout to ensure rendering completes
      }
      
      setLoading(false);
      setLoadingMore(false);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setLoading(false);
      setLoadingMore(false);
      setError('Could not load chat history');
      setIsScrollLocked(false); // Ensure scroll lock is released on error
    }
  }, [API_URL, friendId, processMessages]);
  
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
    if (!messagesContainerRef.current || isScrollLocked || loadingMore) return;
    
    const { scrollTop } = messagesContainerRef.current;
    
    // When user scrolls near TOP (within 50px), load older messages
    if (scrollTop < 50 && !loadingMore && hasMore) {
      console.log('Near top of scroll area, loading older messages');
      setLoadingMore(true);
      
      // Use a short timeout to prevent multiple simultaneous loading attempts
      setTimeout(() => {
        // Double-check we're still in loading state to prevent duplicate loads
        if (!loadingMore) {
          // Load next page of messages
          const nextPage = page + 1;
          setPage(nextPage);
          
          fetchChatHistory(nextPage, true);
        }
      }, 100);
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
        
        // Also join rooms for reaction notifications for all loaded messages
        messages.forEach(msg => {
          socket.emit('join-room', `message-${msg.id}`);
        });
        
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
  }, [socket, friendId, messages]);
  
  // Listen for new messages - modified to add at end of array
  useEffect(() => {
    if (!socket) return;
    
    const handleNewMessage = (message) => {
      // When new message arrives, add to end of message list
      setMessages(prevMessages => {
        // Check if message already exists (avoid duplicates)
        if (prevMessages.some(m => m.id === message.id)) {
          return prevMessages;
        }
        
        // Add new message
        const newMessages = [...prevMessages, message];
        
        // Scroll to bottom after a brief delay
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        }, 100);
        
        return newMessages;
      });
    };
    
    socket.on('new-message', handleNewMessage);
    
    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [friendId, socket]);
  
  // Listen for reaction updates
  useEffect(() => {
    if (!socket) return;
    
    // Handle new reaction added to a message
    const handleNewReaction = (reaction) => {
      console.log("Received new reaction:", reaction);
      setMessages(prevMessages => {
        return prevMessages.map(msg => {
          if (msg.id === reaction.messageId) {
            // Create reactions array if it doesn't exist
            const currentReactions = msg.reactions || [];
            
            // Check if this reaction already exists (by same user with same emoji)
            const existingReactionIndex = currentReactions.findIndex(
              r => r.userId === reaction.userId && r.emoji === reaction.emoji
            );
            
            // If it exists, replace it, otherwise add it
            if (existingReactionIndex >= 0) {
              const updatedReactions = [...currentReactions];
              updatedReactions[existingReactionIndex] = reaction;
              return { ...msg, reactions: updatedReactions };
            } else {
              return { ...msg, reactions: [...currentReactions, reaction] };
            }
          }
          return msg;
        });
      });
    };
    
    // Handle reaction removed from a message
    const handleReactionRemoved = (reaction) => {
      console.log("Reaction removed:", reaction);
      setMessages(prevMessages => {
        return prevMessages.map(msg => {
          if (msg.id === reaction.messageId && msg.reactions) {
            // Filter out the removed reaction
            const updatedReactions = msg.reactions.filter(
              r => !(r.userId === reaction.userId && r.emoji === reaction.emoji)
            );
            return { ...msg, reactions: updatedReactions };
          }
          return msg;
        });
      });
    };
    
    socket.on('new-reaction', handleNewReaction);
    socket.on('reaction-removed', handleReactionRemoved);
    
    return () => {
      socket.off('new-reaction', handleNewReaction);
      socket.off('reaction-removed', handleReactionRemoved);
    };
  }, [socket]);
  
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

  // Add function to handle replying to a message
  const handleReply = (message) => {
    setReplyingTo(message);
    // Focus input field after setting reply
    setTimeout(() => {
      const inputField = document.querySelector('.message-form input');
      if (inputField) inputField.focus();
    }, 100);
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Add function to handle adding a reaction
  const handleReaction = (messageId) => {
    setActiveReactionMessage(messageId === activeReactionMessage ? null : messageId);
    setShowEmojiPicker(messageId === activeReactionMessage ? false : true);
  };

  // Add function to send a reaction
  const sendReaction = async (messageId, emoji) => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.token) {
        setError('You need to be logged in');
        return;
      }
      
      console.log('Reaction emoji object:', emoji);
      
      const reaction = {
        messageId,
        emoji: emoji.unified,
        emojiName: emoji.names ? emoji.names[0] : emoji.name
      };
      
      const response = await axios.post(`${API_URL}/messages/reactions`, reaction, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      console.log('Reaction response:', response.data);
      
      // Hide emoji picker after selecting
      setShowEmojiPicker(false);
      setActiveReactionMessage(null);
    } catch (err) {
      console.error('Error adding reaction:', err);
      setError('Failed to add reaction');
    }
  };

  // Modify sendMessage to include reply information
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
      setError('Connection issue. Message will be sent when connection is restored.');
      setTimeout(() => setError(''), 3000);
    }
    
    try {
      const newMessage = {
        content: messageInput,
        receiverId: friendId,
        senderId: currentUser.id,
        // Add replyToId if replying to a message
        replyToId: replyingTo ? replyingTo.id : null
      };
      
      await axios.post(`${API_URL}/messages`, newMessage, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Clear input and reset reply state
      setMessageInput('');
      setReplyingTo(null);
      
      // Scroll to bottom after sending
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
    
    // Find the message being replied to if applicable
    const replyToMessage = message.replyToId 
      ? messages.find(m => m.id === message.replyToId) 
      : null;
    
    return (
      <div 
        key={message.id} 
        className={`message ${isCurrentUser ? 'sent' : 'received'}`}
        data-message-id={message.id} // Add data attribute for querying
      >
        {/* Show reply context if this message is a reply */}
        {message.replyToId && (
          <div 
            className="reply-context" 
            onClick={() => scrollToMessage(message.replyToId)}
            style={{ cursor: 'pointer' }}
          >
            <div className="reply-indicator">↩️ Reply to:</div>
            <div className="reply-content">
              {replyToMessage 
                ? (replyToMessage.content 
                    ? replyToMessage.content.substring(0, 50) + (replyToMessage.content.length > 50 ? '...' : '')
                    : replyToMessage.mediaUrl 
                      ? '[Media]' 
                      : '[Message]')
                : '[Original message not loaded]'}
            </div>
          </div>
        )}
        
        {/* Show message content if any */}
        {message.content && (
          <div className="message-content">{message.content}</div>
        )}
        
        {/* Show media content */}
        {(message.mediaUrl || (message.hasMedia && !message.mediaUrl)) && (
          <MediaDisplay 
            media={{
              url: message.mediaUrl || '',
              resourceType: message.mediaType || 'image', 
              publicId: message.mediaPublicId || '',
              format: message.mediaFormat || '',
              messageId: message.id,
              // Use message's media timestamp if available, or generate a new one
              timestamp: message.mediaTimestamp || new Date().getTime()
            }}
          />
        )}
        
        {/* Show reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="message-reactions">
            {message.reactions.map((reaction, index) => (
              <span key={index} className="reaction" title={reaction.username}>
                {(() => {
                  try {
                    if (reaction.emoji.includes('-') || reaction.emoji.length > 6) {
                      return String.fromCodePoint(...reaction.emoji.split('-').map(code => parseInt(code, 16)));
                    } else {
                      return String.fromCodePoint(parseInt(reaction.emoji, 16));
                    }
                  } catch (e) {
                    console.error("Error rendering emoji", reaction.emoji, e);
                    return '😊'; // Fallback emoji
                  }
                })()}
              </span>
            ))}
          </div>
        )}
        
        {/* Message actions (reply, react) */}
        <div className="message-actions">
          <button 
            className="action-button reply-button" 
            onClick={() => handleReply(message)}
            title="Reply"
          >
            ↩️
          </button>
          <button 
            className="action-button react-button" 
            onClick={() => handleReaction(message.id)}
            title="React"
          >
            😊
          </button>
          
          {/* Show emoji picker for this message with improved positioning */}
          {showEmojiPicker && activeReactionMessage === message.id && (
            <div className={`emoji-picker-container ${isCurrentUser ? 'emoji-picker-sent' : 'emoji-picker-received'}`}>
              <div className="emoji-picker-close" onClick={() => {
                setShowEmojiPicker(false);
                setActiveReactionMessage(null);
              }}>✕</div>
              <EmojiPicker
                onEmojiClick={(emojiObj) => sendReaction(message.id, emojiObj)}
                disableAutoFocus={true}
                native={true}
                searchPlaceholder="Search emoji..."
                previewConfig={{ showPreview: false }}
                width="min(100vw - 20px, 280px)"
                height="320px"
              />
            </div>
          )}
        </div>
        
        <div className="message-time">
          {new Date(message.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    );
  };

  // Add function to start video call
  const startVideoCall = () => {
    console.log('Video call button clicked');
    console.log('Socket connected:', socketConnected);
    
    if (!socketConnected) {
      setError('Not connected to server. Please wait and try again.');
      return;
    }
    
    // Make the callId more stable and consistent
    const callId = `call_${friendId}_${getCurrentUser().id}`;
    console.log('Generated call ID:', callId);
    
    // Ensure socket is connected before sending invitation
    if (socket && socketConnected) {
      const currentUser = getCurrentUser();
      
      console.log('Sending video call invitation:', {
        callId,
        fromUserId: currentUser.id,
        toUserId: parseInt(friendId),
        fromUsername: currentUser.username
      });
      
      socket.emit('video-call-invitation', {
        callId,
        fromUserId: currentUser.id,
        toUserId: parseInt(friendId),
        fromUsername: currentUser.username
      });
      
      console.log('🎭 ROLE ASSIGNMENT: User is INITIATOR of the call');
      
      // Navigate with clear initiator flag using React Router's state
      navigate(`/videocall/${callId}`, { 
        replace: true,
        state: {
          isInitiator: true,
          fromUserId: currentUser.id,
          toUserId: parseInt(friendId)
        }
      });
    } else {
      setError('Connection not available. Please wait and try again.');
      console.error('Socket not connected for video call');
    }
  };

  // Listen for video call invitations
  useEffect(() => {
    if (!socket) return;
    
    const handleVideoCallInvitation = (data) => {
      const { callId, fromUserId, fromUsername } = data;
      
      // Show confirmation dialog
      const shouldJoin = window.confirm(
        `${fromUsername} is inviting you to a video call. Do you want to join?`
      );
      
      if (shouldJoin) {
        // Make sure we use the exact same callId that was sent
        console.log(`Accepting call with ID: ${callId}`);
        
        // Use replace to prevent navigation stack issues
        navigate(`/videocall/${callId}`, { 
          replace: true,
          state: {
            isInitiator: false, // Explicitly set to false for the receiver
            fromUserId: fromUserId,
            toUserId: getCurrentUser().id
          }
        });
      }
    };
    
    socket.on('video-call-invitation', handleVideoCallInvitation);
    
    return () => {
      socket.off('video-call-invitation', handleVideoCallInvitation);
    };
  }, [socket, navigate]);

  // Function to scroll to a specific message by ID
  const scrollToMessage = (messageId) => {
    // Find the message element by ID
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    
    if (!messageElement) {
      console.log(`Message with ID ${messageId} not found in current view. It might need to be loaded.`);
      setError('Message not found in current view. Try loading more messages.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    // Apply a highlight effect to the target message
    messageElement.classList.add('highlight-message');
    
    // Scroll to the message with a small offset from the top
    const container = messagesContainerRef.current;
    const messageTop = messageElement.offsetTop;
    
    // Smooth scroll to the message position
    container.scrollTo({
      top: messageTop - 100, // 100px offset from top for better visibility
      behavior: 'smooth'
    });
    
    // Remove highlight after a delay
    setTimeout(() => {
      messageElement.classList.remove('highlight-message');
    }, 2000);
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
        
        {/* Add video call button */}
        <div className="chat-actions">
          <button 
            onClick={startVideoCall} 
            className="video-call-btn"
            disabled={!socketConnected}
          >
            📹 Video Call
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
      
      {/* Show reply preview if replying to a message */}
      {replyingTo && (
        <div className="reply-preview">
          <div className="reply-preview-content">
            <span className="reply-to-label">Reply to: </span>
            <span className="reply-text">
              {replyingTo.content 
                ? replyingTo.content.substring(0, 30) + (replyingTo.content.length > 30 ? '...' : '')
                : '[Media]'
              }
            </span>
          </div>
          <button 
            className="cancel-reply" 
            onClick={cancelReply}
            title="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Message form */}
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
          placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
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
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getCurrentUser } from '../services/authService';
import { useCall } from '../contexts/CallContext';
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
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const MESSAGES_PER_PAGE = 20;
  
  // Function to fetch chat history with pagination
  const fetchChatHistory = useCallback(async (pageNum = 1, append = false) => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.token) return;

      const response = await axios.get(
        `${API_URL}/messages/${friendId}?page=${pageNum}&limit=${MESSAGES_PER_PAGE}`, 
        {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        }
      );
      
      const fetchedMessages = response.data.messages || response.data;
      
      if (fetchedMessages.length < MESSAGES_PER_PAGE) {
        setHasMore(false);
      }
      
      if (append) {
        setMessages(prev => [...fetchedMessages, ...prev]);
      } else {
        setMessages(fetchedMessages);
      }
      
      setLoading(false);
      setLoadingMore(false);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setLoading(false);
      setLoadingMore(false);
      setError('Could not load chat history');
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
      
      try {
        // Try the /users endpoint first
        const response = await axios.get(`${API_URL}/users/${friendId}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        
        if (response.data) {
          console.log("Friend info from /users:", response.data);
          setFriendInfo(response.data);
        } else {
          throw new Error("Empty response from users endpoint");
        }
      } catch (userErr) {
        console.error("Error with /users endpoint:", userErr);
        
        // Fallback to /friends endpoint
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
  
  // Handle scroll to load more messages
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop } = messagesContainerRef.current;
    
    // When user scrolls near the top, load more messages
    if (scrollTop < 100 && !loadingMore && hasMore) {
      setLoadingMore(true);
      
      // Store current scroll height to maintain position
      const scrollHeight = messagesContainerRef.current.scrollHeight;
      
      // Load next page of messages
      const nextPage = page + 1;
      setPage(nextPage);
      
      fetchChatHistory(nextPage, true).then(() => {
        // After loading more messages, maintain scroll position
        if (messagesContainerRef.current) {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          messagesContainerRef.current.scrollTop = newScrollHeight - scrollHeight;
        }
      });
    }
  }, [fetchChatHistory, hasMore, loadingMore, page]);
  
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);
  
  // Join chat room when component mounts or friendId/socket changes
  useEffect(() => {
    if (!socket) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Join chat room to receive messages
    const roomId = [currentUser.id, friendId].sort().join('-');
    console.log(`Joining chat room: ${roomId}`);
    socket.emit('join-room', roomId);
    
  }, [friendId, socket]); // Both dependencies are needed
  
  // Listen for new messages
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
        setMessages(prev => [...prev, message]);
      }
    };
    
    // Add event listener
    socket.on('new-message', handleNewMessage);
    
    // Remove event listener on cleanup
    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [friendId, socket]); // Both dependencies are needed
  
  // Auto-scroll to bottom when new messages arrive from the current conversation
  useEffect(() => {
    if (messages.length > 0 && !loadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingMore]);
  
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
      setError('You need to be logged in');
      return;
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
      
      // The socket will handle adding the new message to state
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    }
  };
  
  // Call functions
  const initiateCall = () => {
    console.log('Initiating call to friend ID:', friendId);
    
    // No need to set up a socket connection here as it's already handled by the context
    navigate('/videocall', { state: { recipientId: friendId } });
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
        <button className="video-call-btn" onClick={initiateCall}>
          Video Call
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div 
        className="messages-container" 
        ref={messagesContainerRef}
      >
        {loadingMore && (
          <div className="loading-more-messages">Loading earlier messages...</div>
        )}
        
        {!hasMore && messages.length > 0 && (
          <div className="no-more-messages">Beginning of conversation</div>
        )}
        
        {loading && !loadingMore ? (
          <div className="loading-messages">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start a conversation!</div>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.senderId === getCurrentUser()?.id;
            return (
              <div 
                key={message.id} 
                className={`message ${isCurrentUser ? 'sent' : 'received'}`}
              >
                <div className="message-content">{message.content}</div>
                <div className="message-time">
                  {new Date(message.createdAt).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="message-form" onSubmit={sendMessage}>
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
        />
        <button type="submit" disabled={!messageInput.trim() || loading}>
          Send
        </button>
      </form>
    </div>
  );
}

export default Chat;
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { getCurrentUser } from '../services/authService';
import '../styles/Chat.css';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [friendInfo, setFriendInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const { friendId } = useParams();
  const navigate = useNavigate();
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

  // Fetch friend information and chat history
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
      navigate('/login');
      return;
    }

    const fetchFriendInfo = async () => {
      try {
        const response = await axios.get(`${API_URL}/users/${friendId}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        setFriendInfo(response.data);
      } catch (err) {
        console.error('Error fetching friend info:', err);
        setError('Could not load friend information');
      }
    };

    const fetchChatHistory = async () => {
      try {
        const response = await axios.get(`${API_URL}/messages/${friendId}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        setMessages(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching messages:', err);
        setLoading(false);
        setError('Could not load chat history');
      }
    };

    fetchFriendInfo();
    fetchChatHistory();
  }, [friendId, API_URL, navigate]);

  // Connect to socket.io
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Connect to socket
    socketRef.current = io(SOCKET_URL);
    
    // Join a room specific to this chat (combination of user IDs)
    const chatRoom = [currentUser.id, friendId].sort().join('-');
    socketRef.current.emit('join-room', chatRoom);
    
    // Listen for incoming messages
    socketRef.current.on('new-message', (message) => {
      setMessages(prevMessages => [...prevMessages, message]);
    });
    
    return () => {
      // Disconnect socket on component unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [friendId, SOCKET_URL]); // Added SOCKET_URL to dependency array

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      
      // Note: We don't need to add the message to state here
      // The socket will broadcast it back to us
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button className="back-button" onClick={() => navigate('/friends')}>
          ← Back
        </button>
        <h2>{friendInfo ? friendInfo.username : 'Loading...'}</h2>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="messages-container">
        {loading ? (
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
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getCurrentUser } from '../services/authService';
import '../styles/Friends.css';
import { useNavigate } from 'react-router-dom';

function Friends() {
  const [friends, setFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // Fix API URL to use REACT_APP prefix (required for React apps)
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Memoize the fetchFriends function
  const fetchFriends = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      console.log('Current user:', currentUser);
      if (!currentUser || !currentUser.token) {
        console.error('Authentication issue: No valid user or token found');
        setError('You need to be logged in. Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }
      
      console.log('Fetching friends from:', `${API_URL}/friends`);
      
      const response = await axios.get(`${API_URL}/friends`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      console.log('Friends data:', response.data);
      setFriends(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching friends:', err);
      setLoading(false);
      if (err.response?.status === 404) {
        setError('Friend endpoint not found. Please check your API configuration.');
      } else {
        setError(err.response?.data?.error || err.message || 'An error occurred while fetching friends');
      }
    }
  }, [navigate, API_URL]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);
  
  const searchUsers = async () => {
    if (!searchTerm) return;
    
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.token) {
        setError('You need to be logged in');
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`${API_URL}/users/search?q=${searchTerm}`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Filter out users that are already friends
      const filteredResults = response.data.filter(user => 
        !friends.some(friend => friend.id === user.id)
      );
      
      setSearchResults(filteredResults);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      if (err.response?.status === 404) {
        setError('User search endpoint not found. Please check your API configuration.');
      } else {
        setError(err.response?.data?.error || 'An error occurred while searching users');
      }
    }
  };
  
  const sendFriendRequest = async (userId) => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      
      await axios.post(`${API_URL}/friends/${userId}`, {}, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Update search results to reflect sent request
      setSearchResults(searchResults.map(user => 
        user.id === userId ? {...user, requestSent: true} : user
      ));
      setLoading(false);
      
      // Show a temporary success message
      setError('Friend request sent successfully!');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to send friend request');
    }
  };
  
  const removeFriend = async (friendId) => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      
      await axios.delete(`${API_URL}/friends/${friendId}`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Remove from friends list
      setFriends(friends.filter(friend => friend.id !== friendId));
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to remove friend');
    }
  };

  const startChat = (friendId) => {
    navigate(`/chat/${friendId}`);
  };

  return (
    <div className="friends-container">
      <h1>Friends</h1>
      {error && (
        <div className={error.includes('successfully') ? "success-message" : "error-message"}>
          {error.includes('successfully') ? '✓ ' : 'Error: '}{error}
          {!error.includes('successfully') && (
            <button onClick={() => window.location.reload()}>Try Again</button>
          )}
        </div>
      )}
      
      <div className="search-section">
        <h2>Find Friends</h2>
        <div className="search-bar">
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by username or email"
            onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
          />
          <button onClick={searchUsers} disabled={loading || !searchTerm}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {loading ? (
          <p className="loading">Searching for users...</p>
        ) : (
          <div className="search-results">
            {searchResults.length > 0 ? (
              searchResults.map(user => (
                <div className="user-card" key={user.id}>
                  <div className="user-info">
                    <h3>{user.username}</h3>
                    <p>{user.email}</p>
                  </div>
                  <button 
                    onClick={() => sendFriendRequest(user.id)}
                    disabled={user.requestSent || loading}
                    className={user.requestSent ? "sent" : ""}
                  >
                    {user.requestSent ? "Request Sent" : "Add Friend"}
                  </button>
                </div>
              ))
            ) : searchTerm ? (
              <p>No users found with that username</p>
            ) : null}
          </div>
        )}
      </div>
      
      <div className="friends-list">
        <h2>My Friends</h2>
        {loading ? (
          <p className="loading">Loading your friends...</p>
        ) : friends.length > 0 ? (
          friends.map(friend => (
            <div className="friend-card" key={friend.id}>
              <div className="friend-info">
                <h3>{friend.username}</h3>
                <p>{friend.email}</p>
              </div>
              <div className="friend-actions">
                <button 
                  onClick={() => startChat(friend.id)}
                  className="chat-btn"
                >
                  Chat
                </button>
                <button 
                  onClick={() => removeFriend(friend.id)}
                  className="remove-btn"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>You don't have any friends yet</p>
        )}
      </div>
    </div>
  );
}

export default Friends;
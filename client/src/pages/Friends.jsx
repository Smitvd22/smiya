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
  const [friendRequests, setFriendRequests] = useState([]);
  const navigate = useNavigate();
  
  // Environment-aware API URL
  const API_URL = process.env.REACT_APP_API_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'https://smiya.onrender.com/api' 
      : 'http://localhost:5000/api'
    );

  console.log('API_URL configured as:', API_URL);
  console.log('Environment:', process.env.NODE_ENV);

  // Memoize the fetchFriends function
  const fetchFriends = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      console.log('Current user in fetchFriends:', currentUser);
      
      // More detailed check for authentication
      if (!currentUser) {
        console.error('Authentication issue: No user found');
        setError('You need to be logged in. Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }
      
      if (!currentUser.token) {
        console.error('Authentication issue: No token found', currentUser);
        // Try to log the raw localStorage value for debugging
        const rawUser = localStorage.getItem('user');
        console.log('Raw localStorage user value:', rawUser);
        setError('Invalid authentication. Redirecting to login...');
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
      
      // Better error handling
      if (err.response?.status === 401) {
        console.error('Unauthorized access. Token might be invalid or expired.');
        localStorage.removeItem('user'); // Clear invalid authentication
        setError('Your session has expired. Please login again.');
        setTimeout(() => navigate('/login'), 2000);
      } else if (err.response?.status === 404) {
        setError('Friend endpoint not found. Please check your API configuration.');
      } else {
        setError(err.response?.data?.error || err.message || 'An error occurred while fetching friends');
      }
    }
  }, [navigate, API_URL]);

  // Add function to fetch pending friend requests
  const fetchFriendRequests = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.token) {
        return;
      }
      
      const response = await axios.get(`${API_URL}/friends/requests`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      setFriendRequests(response.data);
    } catch (err) {
      console.error('Error fetching friend requests:', err);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
  }, [fetchFriends, fetchFriendRequests]);
  
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
  
  const acceptFriendRequest = async (requestId) => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      
      await axios.put(`${API_URL}/friends/requests/${requestId}/accept`, {}, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Refresh both lists
      await fetchFriendRequests();
      await fetchFriends();
      
      setLoading(false);
      setError('Friend request accepted successfully!');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to accept friend request');
    }
  };

  const rejectFriendRequest = async (requestId) => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      
      await axios.put(`${API_URL}/friends/requests/${requestId}/reject`, {}, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Remove from requests list
      setFriendRequests(friendRequests.filter(request => request.id !== requestId));
      setLoading(false);
      setError('Friend request rejected');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to reject friend request');
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
      
      {/* Add Friend Requests Section */}
      {friendRequests.length > 0 && (
        <div className="requests-section">
          <h2>Friend Requests</h2>
          <div className="friend-requests">
            {friendRequests.map(request => (
              <div className="user-card" key={request.id}>
                <div className="user-info">
                  <h3>{request.username}</h3>
                  <p>{request.email}</p>
                </div>
                <div className="request-actions">
                  <button 
                    onClick={() => acceptFriendRequest(request.id)}
                    disabled={loading}
                    className="accept-btn"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => rejectFriendRequest(request.id)}
                    disabled={loading}
                    className="reject-btn"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
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
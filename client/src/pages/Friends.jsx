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
      
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
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
      setError(err.message || err.toString());
    }
  }, [navigate]);  // Add navigate as a dependency

  // Now use fetchFriends in useEffect
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);  // Add fetchFriends as a dependency
  
  const searchUsers = async () => {
    if (!searchTerm) return;
    
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      const API_URL = process.env.API_URL || 'https://smiya.onrender.com/api';
      
      const response = await axios.get(`${API_URL}/users/search?q=${searchTerm}`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      setSearchResults(response.data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.toString());
    }
  };
  
  const sendFriendRequest = async (userId) => {
    try {
      const currentUser = getCurrentUser();
      const API_URL = process.env.API_URL || 'https://smiya.onrender.com/api';
      
      await axios.post(`${API_URL}/friends/${userId}`, {}, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      
      // Update search results to reflect sent request
      setSearchResults(searchResults.map(user => 
        user.id === userId ? {...user, requestSent: true} : user
      ));
    } catch (err) {
      setError(err.toString());
    }
  };

  // Add the missing function
  const startChat = (friendId) => {
    navigate(`/chat/${friendId}`);
  };

  return (
    <div className="friends-container">
      <h1>Friends</h1>
      {error && (
        <div className="error-message">
          Error: {error}
          <button onClick={() => window.location.reload()}>Try Again</button>
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
          />
          <button onClick={searchUsers} disabled={loading || !searchTerm}>
            Search
          </button>
        </div>
        
        {loading ? (
          <p>Loading...</p>
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
                    disabled={user.requestSent}
                    className={user.requestSent ? "sent" : ""}
                  >
                    {user.requestSent ? "Request Sent" : "Add Friend"}
                  </button>
                </div>
              ))
            ) : searchTerm ? (
              <p>No users found</p>
            ) : null}
          </div>
        )}
      </div>
      
      <div className="friends-list">
        <h2>My Friends</h2>
        {loading ? (
          <p>Loading...</p>
        ) : friends.length > 0 ? (
          friends.map(friend => (
            <div className="friend-card" key={friend.id}>
              <div className="friend-info">
                <h3>{friend.username}</h3>
                <p>{friend.email}</p>
              </div>
              <button onClick={() => startChat(friend.id)}>Chat</button>
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
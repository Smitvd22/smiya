import axios from 'axios';
import io from 'socket.io-client';

// Singleton pattern for socket management
let socket = null;

// Fix URL and ensure correct endpoints
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const register = async (userData) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    console.log('Registration response:', response.data);
    
    // Store user data consistently
    if (response.data && response.data.token) {
      // Store user data and token in a consistent format
      const authData = {
        id: response.data.user.id,
        username: response.data.user.username,
        email: response.data.user.email,
        mobile: response.data.user.mobile,
        token: response.data.token
      };
      localStorage.setItem('user', JSON.stringify(authData));
    }
    return response.data;
  } catch (error) {
    console.error('Registration error in service:', error);
    throw error;
  }
};

export const login = async (identifier, password) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      identifier,
      password
    });

    console.log('Login API response:', response.data);
    
    if (response.data && response.data.token) {
      // Store user data and token in a consistent format
      const authData = {
        id: response.data.user.id,
        username: response.data.user.username,
        email: response.data.user.email,
        mobile: response.data.user.mobile,
        token: response.data.token
      };
      localStorage.setItem('user', JSON.stringify(authData));
    }
    
    // Initialize socket immediately after successful login
    initializeSocket();
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error.response?.data?.error || 'Failed to log in';
  }
};

export const logout = () => {
  // Clean up socket connection before removing user
  if (socket) {
    console.log('Cleaning up socket on logout');
    socket.disconnect();
    socket = null;
  }
  
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  try {
    const userString = localStorage.getItem('user');
    
    if (!userString) {
      return null;
    }
    
    // Parse the user data from localStorage
    const userData = JSON.parse(userString);
    
    // Make sure we have at least a user ID and token
    if (!userData || !userData.id || !userData.token) {
      console.warn('Invalid user data in localStorage');
      return null;
    }
    
    return userData;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Update the initializeSocket function to include a debug parameter
export const initializeSocket = (debug = false) => {
  // If socket exists and is connected, return it
  if (socket && socket.connected) {
    if (debug) console.log('Reusing existing socket connection:', socket.id);
    return socket;
  }
  
  // If socket exists but is disconnected, clean it up
  if (socket) {
    console.log('Cleaning up disconnected socket');
    socket.disconnect();
    socket = null;
  }
  
  const user = getCurrentUser();
  if (!user) return null;
  
  console.log('Creating new socket connection');
  socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling'], // Allow fallback to polling
    auth: { userId: user.id }
  });
  
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    // Join user's room immediately but only once
    socket.emit('join-user-room', `user-${user.id}`);
  });
  
  // Only log once in authService
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
  
  return socket;
};

// Add a getter to access the current socket instance
export const getSocket = () => {
  return socket;
};
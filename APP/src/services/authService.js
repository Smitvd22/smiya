import axios from 'axios';
import { io } from 'socket.io-client';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// Singleton pattern for socket management
let socket = null;

// Environment-aware API URL
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

console.log('API_URL configured as:', API_URL);
console.log('Environment:', process.env.NODE_ENV || 'development');

// Register a new user
export const register = async (userData) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Registration failed';
    console.error('Registration error:', errorMessage);
    throw new Error(errorMessage);
  }
};

// Login a user
export const login = async (identifier, password) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { identifier, password });
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Login failed';
    console.error('Login error:', errorMessage);
    throw new Error(errorMessage);
  }
};

// Logout function
export const logout = () => {
  // Clean up socket connection before removing user
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  SecureStore.deleteItemAsync('user');
};

// Get the current authenticated user
export const getCurrentUser = async () => {
  try {
    const userString = await SecureStore.getItemAsync('user');
    if (!userString) return null;
    return JSON.parse(userString);
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Initialize Socket.IO connection
export const initializeSocket = () => {
  if (socket && socket.connected) {
    console.log('Using existing socket connection');
    return socket;
  }
  
  // Clean up any existing disconnected socket
  if (socket && !socket.connected) {
    socket.removeAllListeners();
    socket = null;
  }
  
  const getUser = async () => {
    try {
      const userString = await SecureStore.getItemAsync('user');
      if (!userString) return null;
      return JSON.parse(userString);
    } catch (error) {
      console.error('Error getting user from secure storage:', error);
      return null;
    }
  };
  
  getUser().then(user => {
    if (!user) {
      console.log('No authenticated user found, skipping socket initialization');
      return null;
    }
    
    // Determine socket URL based on environment
    const isDev = process.env.NODE_ENV === 'development' || __DEV__;
    const devServerIp = Constants.expoConfig?.extra?.devServerIp || "192.168.1.2";
    const socketUrl = isDev ? `http://${devServerIp}:5000` : 'https://smiya.onrender.com';
    
    console.log(`Initializing socket connection to ${socketUrl}`);
    
    try {
      socket = io(socketUrl, {
        auth: { token: user.token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      
      socket.on('connect', () => {
        console.log('Socket connected successfully');
      });
      
      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });
      
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });
      
      socket.on('reconnect', (attemptNumber) => {
        console.log(`Socket reconnected after ${attemptNumber} attempts`);
      });
      
      socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect socket');
      });
      
      return socket;
    } catch (error) {
      console.error('Error initializing socket:', error);
      return null;
    }
  });
  
  return socket;
};

// Get the current socket instance
export const getSocket = () => socket;

// API call with authentication
export const apiCall = async (method, endpoint, data = null) => {
  try {
    const user = await getCurrentUser();
    if (!user || !user.token) {
      throw new Error('Not authenticated');
    }
    
    const config = {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    };
    
    let response;
    
    switch (method.toLowerCase()) {
      case 'get':
        response = await axios.get(`${API_URL}${endpoint}`, config);
        break;
      case 'post':
        response = await axios.post(`${API_URL}${endpoint}`, data, config);
        break;
      case 'put':
        response = await axios.put(`${API_URL}${endpoint}`, data, config);
        break;
      case 'delete':
        response = await axios.delete(`${API_URL}${endpoint}`, config);
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
    
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message || 'API request failed';
    console.error(`API call error (${endpoint}):`, errorMessage);
    throw new Error(errorMessage);
  }
};

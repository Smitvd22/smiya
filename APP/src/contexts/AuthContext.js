import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { login, register, initializeSocket } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user from secure storage on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userString = await SecureStore.getItemAsync('user');
        if (userString) {
          const userData = JSON.parse(userString);
          setUser(userData);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Login function
  const loginUser = async (identifier, password) => {
    try {
      setError(null);
      setLoading(true);
      
      const result = await login(identifier, password);
      
      // Save user data in secure storage
      await SecureStore.setItemAsync('user', JSON.stringify(result));
      
      // Initialize socket connection
      initializeSocket();
      
      // Update state
      setUser(result);
      return result;
    } catch (error) {
      setError(error.message || 'Login failed. Please check your credentials.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const registerUser = async (userData) => {
    try {
      setError(null);
      setLoading(true);
      
      const result = await register(userData);
      
      // Save user data in secure storage
      await SecureStore.setItemAsync('user', JSON.stringify(result));
      
      // Initialize socket connection
      initializeSocket();
      
      // Update state
      setUser(result);
      return result;
    } catch (error) {
      setError(error.message || 'Registration failed. Please try again.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logoutUser = async () => {
    try {
      // Clear secure storage
      await SecureStore.deleteItemAsync('user');
      
      // Reset state
      setUser(null);
      
      // Clean up socket connection
      // (Socket cleanup is handled in authService.js)
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Get current user
  const getCurrentUser = () => {
    return user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginUser,
        registerUser,
        logoutUser,
        getCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

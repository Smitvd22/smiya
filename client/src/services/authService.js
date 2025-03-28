import axios from 'axios';

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
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error.response?.data?.error || 'Failed to log in';
  }
};

export const logout = () => {
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
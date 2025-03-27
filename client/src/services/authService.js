import axios from 'axios';

// Fix URL and ensure correct endpoints
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const register = async (userData) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    if (response.data.token) {
      localStorage.setItem('user', JSON.stringify(response.data));
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
    if (response.data.token) {
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'An error occurred during login';
  }
};

export const logout = () => {
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error parsing user data from localStorage:', error);
    // Clean up corrupted data
    localStorage.removeItem('user');
    return null;
  }
};
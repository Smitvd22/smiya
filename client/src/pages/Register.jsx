import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/authService';
import '../styles/Auth.css';

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate form
    if (!formData.username || !formData.email || !formData.mobile || !formData.password) {
      setError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Simple phone validation
    const phoneRegex = /^\d{10,12}$/;
    if (!phoneRegex.test(formData.mobile)) {
      setError('Please enter a valid mobile number (10-12 digits)');
      return;
    }

    try {
      setLoading(true);
      setDebugInfo('Sending registration request...');
      
      const userData = {
        username: formData.username,
        email: formData.email,
        mobile: formData.mobile,
        password: formData.password
      };
      
      // Show the full URL being used
      const apiUrl = process.env.API_URL || 'http://localhost:5000/api';
      setDebugInfo(`Sending request to: ${apiUrl}/auth/register`);
      
      console.log('Registration data:', userData);
      const response = await register(userData);
      console.log('Registration response:', response);
      
      setDebugInfo('Registration successful');
      setLoading(false);
      navigate('/friends?registered=true');
    } catch (err) {
      setLoading(false);
      console.error('Registration error details:', err);
      
      // More detailed error information
      let errorMsg = 'Unknown error occurred';
      let statusCode = 'unknown status';
      
      if (err.response) {
        // Server responded with error
        statusCode = err.response.status;
        errorMsg = err.response.data?.error || err.response.statusText;
        console.log('Error response:', err.response);
      } else if (err.request) {
        // Request made but no response received
        errorMsg = 'No response from server - check if server is running';
        console.log('Error request:', err.request);
      } else {
        // Error in request setup
        errorMsg = err.message;
      }
      
      setError(errorMsg);
      setDebugInfo(`Error: ${errorMsg} (${statusCode})`);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create an Account</h2>
        {error && <div className="auth-error">{error}</div>}
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div className="debug-info" style={{color: 'gray', fontSize: '0.8rem', margin: '10px 0'}}>
            Debug: {debugInfo}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Create a username"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="mobile">Mobile Number</label>
            <input
              type="tel"
              id="mobile"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              placeholder="Enter your mobile number"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-button" 
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        
        <div className="auth-footer">
          Already have an account? <Link to="/Login">Log In</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
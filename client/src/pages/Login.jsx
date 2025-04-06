import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { login, getCurrentUser } from '../services/authService';
import '../styles/Auth.css';

function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Reset component state when mounted
  useEffect(() => {
    // This will force the component to reset on mount and when location changes
    setIdentifier('');
    setPassword('');
    setError('');
    setLoading(false);
    setSuccess('');
    
    const user = getCurrentUser();
    if (user) {
      navigate('/friends');
    }
  }, [navigate, location.search]); // Add location.search to dependencies

  // Check if user was redirected after registration or from a protected route
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('registered') === 'true') {
      setSuccess('Registration successful! Please log in.');
    }
    if (params.get('from')) {
      setError(`Please login to access ${params.get('from')}`);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!identifier || !password) {
      setError('Please enter your login details');
      return;
    }

    try {
      setLoading(true);
      await login(identifier, password);
      setLoading(false);
      
      // Get redirect URL from location state or default to friends page
      const from = new URLSearchParams(location.search).get('from') || '/friends';
      navigate(from);
    } catch (err) {
      setLoading(false);
      setError(err.toString());
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login</h2>
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="identifier">Username / Email / Mobile</label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter your username, email, or mobile"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="auth-footer">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
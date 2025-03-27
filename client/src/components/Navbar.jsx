import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../services/authService';
import '../styles/Navbar.css';

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      // Don't set user if there's an error
    }
  }, []);

  const handleLogout = () => {
    try {
      logout();
      setUser(null);
      setShowDropdown(false);
      navigate('/');
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          Smiya
        </Link>
        
        <div className="nav-menu">
          {!user ? (
            // Not logged in - show login/register links
            <>
              <Link to="/" className="nav-item">Home</Link>
              <Link to="/login" className="nav-item">Login</Link>
              <Link to="/register" className="nav-item">Register</Link>
            </>
          ) : (
            // Logged in - show user menu
            <>
              <Link to="/friends" className="nav-item">Friends</Link>
              <div className="profile-container">
                <div 
                  className="profile-menu" 
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <span className="username">{user.username || 'User'}</span>
                  <div className="avatar">
                    {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                </div>
                
                {showDropdown && (
                  <div className="profile-dropdown">
                    <div className="dropdown-user-info">
                      <div className="dropdown-avatar">
                        {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <p className="dropdown-username">{user.username || 'User'}</p>
                        <p className="dropdown-email">{user.email || 'No email'}</p>
                      </div>
                    </div>
                    <hr />
                    <Link to="/friends" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                      Friends
                    </Link>
                    <div className="dropdown-item logout" onClick={handleLogout}>
                      Logout
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
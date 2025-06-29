import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCurrentUser, logout } from '../services/authService';
import '../styles/Navbar.css';

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const location = useLocation();

  // Update user state when location changes or component mounts
  useEffect(() => {
    const updateUserState = () => {
      const currentUser = getCurrentUser();
      setUser(currentUser);
    };
    
    // Initial check
    updateUserState();
    
    // Add event listener for storage changes (for cross-tab login/logout)
    const handleStorageChange = () => {
      updateUserState();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [location.pathname]);

  // Handle scroll events to show/hide navbar
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Direction detection with stronger threshold for mobile
          const scrollingDown = window.scrollY > lastScrollY + 5;
          const scrollingUp = window.scrollY < lastScrollY - 5;
          
          if (scrollingDown && window.scrollY > 50) {
            setShowNavbar(false);
          } else if (scrollingUp) {
            setShowNavbar(true);
          }
          
          lastScrollY = window.scrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleLogout = () => {
    // Clear user data
    logout();
    setUser(null);
    setShowDropdown(false);
    
    // Force a complete page refresh when navigating to homepage
    // This ensures all components are freshly mounted
    window.location.href = '/home';
  };

  return (
    <nav className={`navbar ${showNavbar ? 'navbar-visible' : 'navbar-hidden'}`}>
      <div className="navbar-container">
        <Link to="/home" className="navbar-logo">
          Smiya
        </Link>
        
        <div className={`menu-toggle ${menuOpen ? 'active' : ''}`} onClick={toggleMenu}>
          <span></span>
          <span></span>
          <span></span>
        </div>
        
        <div className={`nav-menu ${menuOpen ? 'active' : ''}`}>
          <Link to="/birthday" className="nav-item birthday-nav-item">
            🎂 Birthday Wishes
          </Link>
          
          {!user ? (
            // Not logged in - show login/register links
            <>
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
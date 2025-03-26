import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="home-container">
      <div className="hero-section">
        <h1>Welcome to Smiya</h1>
        <p>Connect with friends, share moments, and stay in touch.</p>
        
        <div className="auth-buttons">
          <Link to="/login" className="btn btn-primary">
            Login
          </Link>
          <Link to="/register" className="btn btn-outline">
            Register
          </Link>
        </div>
      </div>
      
      <div className="features-section">
        <h2>Our Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Real-time Messaging</h3>
            <p>Connect with friends and family instantly</p>
          </div>
          <div className="feature-card">
            <h3>Video Calls</h3>
            <p>Face-to-face conversations no matter the distance</p>
          </div>
          <div className="feature-card">
            <h3>Secure Platform</h3>
            <p>Your privacy is our priority</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
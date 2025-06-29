import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

function LandingPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // Add effect to hide navbar when landing page mounts
  useEffect(() => {
    // Add class to hide navbar
    document.body.classList.add('landing-page-active');
    
    // Clean up when component unmounts
    return () => {
      document.body.classList.remove('landing-page-active');
    };
  }, []);

  const openSidebar = () => {
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Handle navigation for each option
  const handleNavigation = (route) => {
    navigate(`/${route}`);
  };

  return (
    <div className="landing-container">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <span className="close-btn" onClick={closeSidebar}>&times;</span>
        <div className="sidebar-content">
          <a href="#" onClick={() => handleNavigation('revision')}>Revision</a>
          <a href="#" onClick={() => handleNavigation('course')}>Course</a>
          <a href="#" onClick={() => handleNavigation('previous-year')}>Previous Year</a>
          <a href="#" onClick={() => handleNavigation('syllabus')}>Syllabus</a>
        </div>
      </div>

      {/* Overlay */}
      <div 
        className={`overlay ${sidebarOpen ? 'open' : ''}`} 
        onClick={closeSidebar}
      ></div>

      {/* Main Content */}
      <div className="main-content">
        <div className="header">
          <div className="hamburger" onClick={openSidebar}>
            <div className="hamburger-line"></div>
            <div className="hamburger-line"></div>
            <div className="hamburger-line"></div>
          </div>
          <h1>Study Portal</h1>
        </div>

        <div className="welcome-section">
          <h2>Welcome to the Study Portal</h2>
          <p>Select an option below to continue:</p>
        </div>

        <div className="options-grid">
          <div className="option-card" onClick={() => handleNavigation('revision')}>
            <h3>Revision</h3>
            <p>Access revision notes, flashcards and study materials</p>
          </div>
          
          <div className="option-card" onClick={() => handleNavigation('course')}>
            <h3>Course</h3>
            <p>Browse through course content and lectures</p>
          </div>
          
          <div className="option-card" onClick={() => handleNavigation('previous-year')}>
            <h3>Previous Year</h3>
            <p>Practice with previous year question papers</p>
          </div>
          
          <div className="option-card" onClick={() => handleNavigation('syllabus')}>
            <h3>Syllabus</h3>
            <p>View complete syllabus and curriculum details</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
import React, { useEffect, useRef, useState } from 'react';
import '../styles/BirthdayWish.css';

function BirthdayWish() {
  const cards = useRef([]);
  const [activePopupIndex, setActivePopupIndex] = useState(0);
  const [visitedPopups, setVisitedPopups] = useState([0]);
  const [lines, setLines] = useState([]);
  const [showPopups, setShowPopups] = useState(false);
  
  // Calculate 10 fixed positions along a heart shape with a better spread
  const heartPositions = Array(10).fill(0).map((_, i) => {
    // Distribute points around the heart with better spacing
    // Start at top of heart (Math.PI/2) and go around
    const t = Math.PI / 2 + (i * ((2 * Math.PI) / 10));
    const scale = 250; // Size of the heart
    const adjustedX = 16 * Math.pow(Math.sin(t), 3) * (scale / 16);
    const adjustedY = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * (scale / 16);
    return { x: adjustedX, y: adjustedY };
  });
  
  // Calculate distinct positions outside the heart for popups with no overlapping
  const popupPositions = Array(10).fill(0).map((_, i) => {
    // Evenly distribute points around the heart with custom angle adjustments
    // Add slight angle offsets to prevent overlapping for problematic positions
    let angleOffset = 0;
    if (i === 1) angleOffset = 0.15; // Push popup 1 slightly clockwise
    if (i === 2) angleOffset = -0.1; // Push popup 2 slightly counterclockwise
    if (i === 5) angleOffset = 0.15; // Push popup 5 slightly clockwise
    if (i === 6) angleOffset = -0.1; // Push popup 6 slightly counterclockwise
    
    const t = Math.PI / 2 + (i * ((2 * Math.PI) / 10)) + angleOffset;
    
    // Calculate heart point
    const scale = 250; // Same as heart scale
    const heartX = 16 * Math.pow(Math.sin(t), 3) * (scale / 16);
    const heartY = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * (scale / 16);
    
    // Calculate normal vector (approximate)
    const offset = 0.01;
    const tOffset = t + offset;
    const heartXOffset = 16 * Math.pow(Math.sin(tOffset), 3) * (scale / 16);
    const heartYOffset = -(13 * Math.cos(tOffset) - 5 * Math.cos(2*tOffset) - 2 * Math.cos(3*tOffset) - Math.cos(4*tOffset)) * (scale / 16);
    
    // Get tangent vector and rotate 90 degrees to get normal
    const tangentX = heartXOffset - heartX;
    const tangentY = heartYOffset - heartY;
    const normalX = -tangentY;
    const normalY = tangentX;
    
    // Normalize the normal vector
    const normalLength = Math.sqrt(normalX * normalX + normalY * normalY);
    const normalizedX = normalX / normalLength;
    const normalizedY = normalY / normalLength;
    
    // Set a distance pattern based on position to prevent overlapping
    // First popup gets base distance, then we alternate to create more space
    const baseDistance = 220; // Increased base distance from heart
    
    // Create a pattern to ensure good distribution - different distances for different positions
    let distancePattern;
    if (i === 0) distancePattern = baseDistance + 30; // Top
    else if (i === 1) distancePattern = baseDistance + 70; // Upper right - push further out
    else if (i === 2) distancePattern = baseDistance + 60; // Right upper
    else if (i === 3) distancePattern = baseDistance + 40; // Right lower
    else if (i === 4) distancePattern = baseDistance + 50; // Bottom right
    else if (i === 5) distancePattern = baseDistance + 70; // Bottom left - push further out
    else if (i === 6) distancePattern = baseDistance + 60; // Left lower
    else if (i === 7) distancePattern = baseDistance + 40; // Left middle
    else if (i === 8) distancePattern = baseDistance + 50; // Left upper
    else distancePattern = baseDistance + 40; // Top left
    
    return {
      x: heartX + normalizedX * distancePattern,
      y: heartY + normalizedY * distancePattern
    };
  });
  
  // Popup content for each step
  const popupContent = [
    { title: "1?", yesText: "Yes", noText: "No" },
    { title: "2?", yesText: "Yes", noText: "No" },
    { title: "3?", yesText: "Yes", noText: "No" },
    { title: "4?", yesText: "Yes", noText: "No" },
    { title: "5?", yesText: "Yes", noText: "No" },
    { title: "6?", yesText: "Yes", noText: "No" },
    { title: "7?", yesText: "Yes", noText: "No" },
    { title: "8?", yesText: "Yes", noText: "No" },
    { title: "9?", yesText: "Yes", noText: "No" },
    { title: "10?", yesText: "Yes", noText: "No" }
  ];
  
  // Prevent scrolling when popups are visible
  useEffect(() => {
    if (showPopups) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [showPopups]);
  
  // Show popups after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPopups(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    // Add scroll animation for the cards
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('card-visible');
          }
        });
      },
      { threshold: 0.3 }
    );
    
    const currentCards = [...cards.current];
    
    currentCards.forEach((card) => {
      observer.observe(card);
    });
    
    return () => {
      currentCards.forEach((card) => {
        if (card) observer.unobserve(card);
      });
    };
  }, []);
  
  const handleYesClick = () => {
    // Create a line from current popup to heart point and from heart point to next popup
    if (activePopupIndex < 9) {
      const currentPopupPos = popupPositions[activePopupIndex];
      const currentHeartPos = heartPositions[activePopupIndex];
      const nextHeartPos = heartPositions[activePopupIndex + 1];
      const nextPopupPos = popupPositions[activePopupIndex + 1];
      
      // Line from current popup to current heart point
      setLines(prev => [
        ...prev, 
        { 
          x1: currentPopupPos.x, 
          y1: currentPopupPos.y, 
          x2: currentHeartPos.x, 
          y2: currentHeartPos.y,
          key: `line-${activePopupIndex}-heart-${activePopupIndex}`
        }
      ]);
      
      // Line along heart from current to next
      setLines(prev => [
        ...prev, 
        { 
          x1: currentHeartPos.x, 
          y1: currentHeartPos.y, 
          x2: nextHeartPos.x, 
          y2: nextHeartPos.y,
          key: `line-heart-${activePopupIndex}-${activePopupIndex + 1}`
        }
      ]);
      
      // Line from heart point to next popup
      setLines(prev => [
        ...prev, 
        { 
          x1: nextHeartPos.x, 
          y1: nextHeartPos.y, 
          x2: nextPopupPos.x, 
          y2: nextPopupPos.y,
          key: `line-heart-${activePopupIndex + 1}-popup-${activePopupIndex + 1}`
        }
      ]);
      
      // Move to next popup
      const nextIndex = activePopupIndex + 1;
      setActivePopupIndex(nextIndex);
      setVisitedPopups(prev => [...prev, nextIndex]);
    } else {
      // Complete the journey
      setShowPopups(false);
    }
  };
  
  const handleNoClick = () => {
    // Visual feedback for "No" click - could add a small shake animation
  };

  const birthdayCards = [
    {
      id: 1,
      theme: 'blue',
      image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d',
      message: 'May your birthday be as wonderful and unique as you are!',
      sender: 'Your Smiya Friends'
    },
    {
      id: 2,
      theme: 'purple',
      image: 'https://images.unsplash.com/photo-1611048661702-7b55eed346b4',
      message: 'Another year of amazing adventures awaits you. Happy Birthday!',
      sender: 'The Smiya Team'
    },
    {
      id: 3,
      theme: 'green',
      image: 'https://images.unsplash.com/photo-1612540139150-4c5f872a2cd3',
      message: 'Wishing you a day filled with happiness and a year filled with joy!',
      sender: 'Your Smiya Family'
    },
    {
      id: 4,
      theme: 'orange',
      image: 'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec',
      message: 'May today be the start of a wonderful, glorious and joyful year to come.',
      sender: 'Everyone at Smiya'
    },
    {
      id: 5,
      theme: 'pink',
      image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176',
      message: 'Count your life by smiles, not tears. Count your age by friends, not years!',
      sender: 'With love from Smiya'
    }
  ];
  
  const addToRefs = (el) => {
    if (el && !cards.current.includes(el)) {
      cards.current.push(el);
    }
  };

  return (
    <div className="birthday-container">
      {/* Add blur overlay when popups are active */}
      {showPopups && (
        <>
          <div className="blur-overlay"></div>
          
          {/* Render connecting lines between popups */}
          <svg className="connection-lines" width="100%" height="100%" style={{ position: 'fixed', top: 0, left: 0, zIndex: 999, pointerEvents: 'none' }}>
            {lines.map((line) => (
              <line
                key={line.key}
                x1={`calc(50% + ${line.x1}px)`}
                y1={`calc(50% + ${line.y1}px)`}
                x2={`calc(50% + ${line.x2}px)`}
                y2={`calc(50% + ${line.y2}px)`}
                stroke="#ff69b4"
                strokeWidth="3"
                strokeDasharray="5,5"
                className="connection-line"
              />
            ))}
          </svg>
          
          {/* Draw heart outline with dotted lines */}
          <svg className="heart-outline" width="100%" height="100%" style={{ position: 'fixed', top: 0, left: 0, zIndex: 998, pointerEvents: 'none' }}>
            <path
              d={`M ${heartPositions.map((pos, i) => 
                  i === 0 ? `calc(50% + ${pos.x}px) calc(50% + ${pos.y}px)` : 
                  `L calc(50% + ${pos.x}px) calc(50% + ${pos.y}px)`
                ).join(' ')} Z`}
              stroke="#ff69b4"
              strokeWidth="2"
              strokeDasharray="5,5"
              fill="none"
              className="heart-path"
            />
          </svg>
          
          {/* Render all popups - show only visited ones with improved sizing */}
          {popupPositions.map((pos, index) => (
            visitedPopups.includes(index) && (
              <div
                key={`popup-${index}`}
                className={`birthday-popup ${index !== activePopupIndex ? 'inactive-popup' : ''} ${index % 2 === 1 ? 'second-popup' : ''}`}
                style={{
                  position: 'fixed',
                  top: `calc(50% + ${pos.y}px)`,
                  left: `calc(50% + ${pos.x}px)`,
                  transform: 'translate(-50%, -50%)',
                  maxWidth: '250px', // Reduced width to prevent overlap
                  zIndex: index === activePopupIndex ? 1002 : 1001 // Active popup gets higher z-index
                }}
              >
                <h3>{popupContent[index].title}</h3>
                {index === activePopupIndex && (
                  <div className="popup-buttons">
                    <button className="popup-btn yes-btn" onClick={handleYesClick}>
                      {popupContent[index].yesText}
                    </button>
                    <button className="popup-btn no-btn" onClick={handleNoClick}>
                      {popupContent[index].noText}
                    </button>
                  </div>
                )}
              </div>
            )
          ))}
        </>
      )}
      
      {/* The rest of your component remains the same */}
      <div className="birthday-header">
        <h1>Birthday Wishes</h1>
        <p>Send beautiful birthday wishes to your friends and family</p>
        <div className="birthday-decoration">
          <span>🎂</span>
          <span>🎁</span>
          <span>🎉</span>
          <span>🎈</span>
        </div>
      </div>
      
      <div className="birthday-cards">
        {birthdayCards.map((card) => (
          <div 
            key={card.id} 
            ref={addToRefs}
            className={`birthday-card card-theme-${card.theme}`}
          >
            <div className="card-image">
              <img src={card.image} alt="Birthday" />
            </div>
            <div className="card-content">
              <div className="confetti">
                <span>🎊</span>
                <span>✨</span>
                <span>🎉</span>
              </div>
              <h3>Happy Birthday!</h3>
              <p className="card-message">{card.message}</p>
              <p className="card-sender">- {card.sender}</p>
              <button className="share-wish">Share This Wish</button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="create-wish-section">
        <h2>Create Your Own Birthday Wish</h2>
        <p>Customize a special birthday message for someone you care about</p>
        <button className="create-wish-btn">Create Custom Wish</button>
      </div>
    </div>
  );
}

export default BirthdayWish;
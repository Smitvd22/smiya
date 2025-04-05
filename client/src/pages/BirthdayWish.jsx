import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import '../styles/BirthdayWish.css';

function BirthdayWish() {
  const cards = useRef([]);
  const [activePopupIndex, setActivePopupIndex] = useState(0);
  const [visitedPopups, setVisitedPopups] = useState([0]);
  const [lines, setLines] = useState([]);
  const [showPopups, setShowPopups] = useState(false);
  const [scale, setScale] = useState(1);
  const [heartCompleted, setHeartCompleted] = useState(false);
  const containerRef = useRef(null);
  
  // Calculate 10 fixed positions along a heart shape (for the heart path)
  const heartPositions = Array(10).fill(0).map((_, i) => {
    // Distribute points around the heart with better spacing
    // Start at top of heart (Math.PI/2) and go around
    const t = Math.PI / 2 + (i * ((2 * Math.PI) / 10));
    const baseScale = 250; // Base size of the heart
    const adjustedX = 16 * Math.pow(Math.sin(t), 3) * (baseScale / 16);
    const adjustedY = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * (baseScale / 16);
    return { x: adjustedX, y: adjustedY };
  });
  
  // Updated manual positions for 6 popups
  const manualPopupPositions = [
    { x: 280, y: -100 },    // 1
    { x: -45, y: 270 },     // Merged 3 & 4
    { x: -350, y: -100 },   // 6
    { x: -175, y: -270 },   // 7
    { x: -35, y: -90 },    // Merged 8 & 9
    { x: 50, y: -320 }     // 10
  ];
  
  // Calculate scaled positions for responsiveness
  const popupPositions = manualPopupPositions.map(pos => ({
    x: pos.x * scale,
    y: pos.y * scale
  }));
  
  // Updated popup content for 6 steps
  const popupContent = [
    { title: "1?", yesText: "Yes", noText: "No" },
    { title: "2?", yesText: "Yes", noText: "No" },
    { title: "3?", yesText: "Yes", noText: "No" },
    { title: "4?", yesText: "Yes", noText: "No" },
    { title: "5?", yesText: "Yes", noText: "No" },
    { title: "6?", yesText: "Yes", noText: "No" }
  ];
  
  // Calculate responsive scale based on viewport size
  useLayoutEffect(() => {
    const updateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const baseWidth = 1440; // Base design width
      
      // Calculate scale factors for width and height
      const widthScale = viewportWidth / baseWidth;
      const heightScale = viewportHeight / 800; // Assuming 800px base height
      
      // Use the smaller scale to ensure everything fits
      const newScale = Math.min(widthScale, heightScale, 1);
      setScale(Math.max(newScale, 0.5)); // Set minimum scale to 0.5
    };
    
    // Initial calculation
    updateScale();
    
    // Update on resize
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);
  
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
  
  // Card animations
  useEffect(() => {
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
    if (activePopupIndex < 5) {
      // Add two heart segments per click
      const start = activePopupIndex * 2;
      const mid = (start + 1) % 10;
      const end = (start + 2) % 10;

      setLines(prev => [
        ...prev,
        { 
          x1: heartPositions[start].x,
          y1: heartPositions[start].y,
          x2: heartPositions[mid].x,
          y2: heartPositions[mid].y,
          key: `line-${start}-${mid}`
        },
        {
          x1: heartPositions[mid].x,
          y1: heartPositions[mid].y,
          x2: heartPositions[end].x,
          y2: heartPositions[end].y,
          key: `line-${mid}-${end}`
        }
      ]);

      const nextIndex = activePopupIndex + 1;
      setActivePopupIndex(nextIndex);
      setVisitedPopups(prev => [...prev, nextIndex]);
    } else {
      // Final click - complete heart
      setHeartCompleted(true);
      setTimeout(() => {
        setShowPopups(false);
        setHeartCompleted(false);
      }, 3200); // Match total animation duration (2.1s + 1.0s + slight buffer)
    }
  };
  
  const handleNoClick = () => {
    // Get reference to active popup
    const popups = document.querySelectorAll('.birthday-popup');
    const activePopup = Array.from(popups).find(popup => 
      !popup.classList.contains('inactive-popup')
    );
    
    if (activePopup) {
      // Add shake class for animation
      activePopup.classList.add('shake-animation');
      
      // Remove the class after animation completes
      setTimeout(() => {
        activePopup.classList.remove('shake-animation');
      }, 500); // Duration matches the CSS animation
    }
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
    <div className="birthday-container" ref={containerRef}>
      {/* Add blur overlay when popups are active */}
      {showPopups && (
        <>
          <div className="blur-overlay"></div>
          
          {/* Render connecting lines between heart points */}
          <svg className="connection-lines" width="100%" height="100%" style={{ position: 'fixed', top: 0, left: 0, zIndex: 1000, pointerEvents: 'none' }}>
            {lines.map((line) => (
              <line
                key={line.key}
                x1={`calc(50% + ${line.x1 * scale}px)`}
                y1={`calc(50% + ${line.y1 * scale}px)`}
                x2={`calc(50% + ${line.x2 * scale}px)`}
                y2={`calc(50% + ${line.y2 * scale}px)`}
                stroke="#ff69b4"
                strokeWidth={3 * Math.max(scale, 0.5)}
                strokeDasharray="5,5"
                className={`connection-line ${heartCompleted ? 'heart-completed' : ''}`}
              />
            ))}
            
            {heartCompleted && (
              <path
                d="M50,15 C22,15 0,35 0,60 C0,75 10,90 30,105 C50,120 50,125 50,125 C50,125 50,120 70,105 C90,90 100,75 100,60 C100,35 78,15 50,15 Z"
                fill="#ff69b4"
                className="heart-fill"
                style={{
                  transform: `translate(calc(50% - 50px), calc(50% - 60px)) scale(${scale})`,
                  transformOrigin: 'center center'
                }}
              />
            )}
          </svg>
          
          {/* Render all popups - show only visited ones */}
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
                  maxWidth: `${250 * scale}px`, 
                  padding: `${20 * scale}px ${30 * scale}px`,
                  fontSize: `${scale > 0.8 ? '1em' : '0.9em'}`,
                  zIndex: index === activePopupIndex ? 1002 : 1001
                }}
              >
                <h3>{popupContent[index].title}</h3>
                {index === activePopupIndex && (
                  <>
                    {index < 5 ? (
                      <div className="popup-buttons">
                        <button className="popup-btn yes-btn" onClick={handleYesClick}>
                          {popupContent[index].yesText}
                        </button>
                        <button className="popup-btn no-btn" onClick={handleNoClick}>
                          {popupContent[index].noText}
                        </button>
                      </div>
                    ) : (
                      <div className="popup-complete">
                        <p>Heart complete! ❤️</p>
                        <button className="popup-btn continue-btn" onClick={handleYesClick}>
                          Continue
                        </button>
                      </div>
                    )}
                  </>
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
import React, { useEffect, useRef, useState } from 'react';
import '../styles/BirthdayWish.css';

function BirthdayWish() {
  const cards = useRef([]);
  const [showFirstPopup, setShowFirstPopup] = useState(false);
  const [showSecondPopup, setShowSecondPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [attempts, setAttempts] = useState(0);
  
  // Prevent scrolling when popup is visible
  useEffect(() => {
    if (showFirstPopup || showSecondPopup) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, [showFirstPopup, showSecondPopup]);
  
  useEffect(() => {
    // Show first popup after a short delay when page loads
    const timer = setTimeout(() => {
      setShowFirstPopup(true);
      // Set initial position slightly off-center
      setRandomPopupPosition();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Add scroll animation
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
    
    // Store current cards for cleanup
    const currentCards = [...cards.current];
    
    // Observe all cards
    currentCards.forEach((card) => {
      observer.observe(card);
    });
    
    // Cleanup using stored cards reference
    return () => {
      currentCards.forEach((card) => {
        if (card) observer.unobserve(card);
      });
    };
  }, []);
  
  // Function to set random popup position
  const setRandomPopupPosition = () => {
    // Generate more dramatic positions for larger movements
    const maxX = window.innerWidth * 0.8;
    const maxY = window.innerHeight * 0.8;
    
    // Multiplier to make movement 10x more dramatic (as requested)
    const multiplier = 3; // Increasing the multiplier for more dramatic effect
    
    // Force significant movement by always alternating between screen quadrants
    const quadrant = Math.floor(Math.random() * 4); // 0,1,2,3
    
    let newX, newY;
    
    switch(quadrant) {
      case 0: // top-left
        newX = -(Math.random() * maxX/2 + maxX/4) * multiplier;
        newY = -(Math.random() * maxY/2 + maxY/4) * multiplier;
        break;
      case 1: // top-right
        newX = (Math.random() * maxX/2 + maxX/4) * multiplier;
        newY = -(Math.random() * maxY/2 + maxY/4) * multiplier;
        break;
      case 2: // bottom-left
        newX = -(Math.random() * maxX/2 + maxX/4) * multiplier;
        newY = (Math.random() * maxY/2 + maxY/4) * multiplier;
        break;
      case 3: // bottom-right
        newX = (Math.random() * maxX/2 + maxX/4) * multiplier;
        newY = (Math.random() * maxY/2 + maxY/4) * multiplier;
        break;
      default: // Fallback position (center with slight offset)
        newX = (Math.random() > 0.5 ? 1 : -1) * maxX/4;
        newY = (Math.random() > 0.5 ? 1 : -1) * maxY/4;
        break;
    }

    // Force re-rendering by using a unique value each time
    const timestamp = Date.now();
    
    // Use functional state update to ensure we're working with latest state
    setPopupPosition(prevPosition => ({
      x: newX,
      y: newY,
      timestamp // Adding timestamp to force state change even if x,y are similar
    }));
  };

  const handleFirstYesClick = () => {
    setShowFirstPopup(false);
    setShowSecondPopup(true);
    setRandomPopupPosition(); // Already here, this is good
  };
  
  const handleFirstNoClick = () => {
    // Move popup to a new position with each "no" click
    setAttempts(attempts + 1);
    
    // After 3 attempts, make the popup more persistent but still allow closing
    if (attempts >= 3) {
      handleFirstYesClick();
    } else {
      // Generate random offset for popup position
      setRandomPopupPosition(); // Already here, this is good
    }
  };
  
  const handleSecondYesClick = () => {
    setRandomPopupPosition(); // Add this line to change position when Yes is clicked
    setShowSecondPopup(false);
    // Optional: Show a thank you message or confetti animation
  };
  
  const handleSecondNoClick = () => {
    // Similar pattern as first popup
    setAttempts(attempts + 1);
    
    if (attempts >= 5) {
      handleSecondYesClick();
    } else {
      setRandomPopupPosition(); // Already here, this is good
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
    },
  ];
  
  const addToRefs = (el) => {
    if (el && !cards.current.includes(el)) {
      cards.current.push(el);
    }
  };

  return (
    <div className="birthday-container">
      {/* Add blur overlay when popups are active */}
      {(showFirstPopup || showSecondPopup) && <div className="blur-overlay"></div>}
      
      {showFirstPopup && (
        <div 
          key={`popup-1-${popupPosition.timestamp || Math.random()}`}
          className="birthday-popup"
          style={{
            transform: `translate(calc(-50% + ${popupPosition.x}px), calc(-50% + ${popupPosition.y}px))`,
            transition: 'transform 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)'
          }}
        >
          <h3>Would you like to create a birthday wish?</h3>
          <div className="popup-buttons">
            <button className="popup-btn yes-btn" onClick={handleFirstYesClick}>Yes</button>
            <button className="popup-btn no-btn" onClick={handleFirstNoClick}>No</button>
          </div>
        </div>
      )}
      
      {showSecondPopup && (
        <div 
          key={`popup-2-${popupPosition.timestamp || Math.random()}`}
          className="birthday-popup second-popup"
          style={{
            transform: `translate(calc(-50% + ${popupPosition.x}px), calc(-50% + ${popupPosition.y}px))`,
            transition: 'transform 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)'
          }}
        >
          <h3>Would you like to see our special birthday templates?</h3>
          <div className="popup-buttons">
            <button className="popup-btn yes-btn" onClick={handleSecondYesClick}>Yes, show me!</button>
            <button className="popup-btn no-btn" onClick={handleSecondNoClick}>Not now</button>
          </div>
        </div>
      )}
      
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
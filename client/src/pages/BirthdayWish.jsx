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
    // Evenly distribute points around the heart
    const t = Math.PI / 2 + (i * ((2 * Math.PI) / 10));
    const scale = 250; // Increased scale to make the heart larger
    const adjustedX = 16 * Math.pow(Math.sin(t), 3) * (scale / 16);
    const adjustedY = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * (scale / 16);
    return { x: adjustedX, y: adjustedY };
  });
  
  // Popup content for each step
  const popupContent = [
    { title: "Would you like to create a birthday wish?", yesText: "Yes", noText: "No" },
    { title: "Would you like to see our special templates?", yesText: "Yes, please", noText: "Not now" },
    { title: "Would you like to add a personal message?", yesText: "Of course", noText: "Skip this" },
    { title: "Should we add some decorations?", yesText: "Yes, make it fancy", noText: "Keep it simple" },
    { title: "Want to include a photo?", yesText: "Add photo", noText: "No photo" },
    { title: "Would you like to schedule delivery?", yesText: "Schedule it", noText: "Send now" },
    { title: "Would you like to include a gift card?", yesText: "Yes, add gift", noText: "No thanks" },
    { title: "Would you like to share on social media?", yesText: "Share it", noText: "Keep private" },
    { title: "Would you like to save this for later?", yesText: "Save it", noText: "Finish now" },
    { title: "Want to create another wish?", yesText: "Create new", noText: "I'm done" }
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
    // Create a line from current popup to next popup
    if (activePopupIndex < 9) {
      const currentPos = heartPositions[activePopupIndex];
      const nextPos = heartPositions[activePopupIndex + 1];
      
      setLines(prev => [
        ...prev, 
        { 
          x1: currentPos.x, 
          y1: currentPos.y, 
          x2: nextPos.x, 
          y2: nextPos.y,
          key: `line-${activePopupIndex}-${activePopupIndex + 1}`
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
          
          {/* Render all popups - show only visited ones */}
          {heartPositions.map((pos, index) => (
            visitedPopups.includes(index) && (
              <div
                key={`popup-${index}`}
                className={`birthday-popup ${index !== activePopupIndex ? 'inactive-popup' : ''} ${index % 2 === 1 ? 'second-popup' : ''}`}
                style={{
                  position: 'fixed',
                  top: `calc(50% + ${pos.y}px)`,
                  left: `calc(50% + ${pos.x}px)`,
                  transform: 'translate(-50%, -50%)'
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
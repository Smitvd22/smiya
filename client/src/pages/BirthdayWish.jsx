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
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const containerRef = useRef(null);

  const heartPositions = Array(10).fill(0).map((_, i) => {
    const t = Math.PI / 2 + (i * ((2 * Math.PI) / 10));
    const baseScale = 250;
    const adjustedX = 16 * Math.pow(Math.sin(t), 3) * (baseScale / 16);
    const adjustedY = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * (baseScale / 16);
    return { x: adjustedX, y: adjustedY };
  });

  const manualPopupPositions = [
    { x: 280, y: -100 },
    { x: -45, y: 270 },
    { x: -350, y: -100 },
    { x: -175, y: -270 },
    { x: -35, y: -90 },
    { x: 50, y: -320 }
  ];

  const popupPositions = manualPopupPositions.map(pos => ({
    x: pos.x * scale,
    y: pos.y * scale
  }));

  const popupContent = [
    { title: "1?", yesText: "Yes", noText: "No" },
    { title: "2?", yesText: "Yes", noText: "No" },
    { title: "3?", yesText: "Yes", noText: "No" },
    { title: "4?", yesText: "Yes", noText: "No" },
    { title: "5?", yesText: "Yes", noText: "No" },
    { title: "6?", yesText: "Yes", noText: "No" }
  ];

  useLayoutEffect(() => {
    const updateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const baseWidth = 1440;

      const widthScale = viewportWidth / baseWidth;
      const heightScale = viewportHeight / 800;

      const newScale = Math.min(widthScale, heightScale, 1);
      setScale(Math.max(newScale, 0.5));
    };

    updateScale();

    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPopups(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

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
      setShowPopups(false);
      setShowHeartAnimation(true);

      setTimeout(() => {
        setHeartCompleted(true);

        setTimeout(() => {
          setHeartCompleted(false);
          setShowHeartAnimation(false);
        }, 3200);
      }, 100);
    }
  };

  const handleNoClick = () => {
    const popups = document.querySelectorAll('.birthday-popup');
    const activePopup = Array.from(popups).find(popup =>
      !popup.classList.contains('inactive-popup')
    );

    if (activePopup) {
      activePopup.classList.add('shake-animation');

      setTimeout(() => {
        activePopup.classList.remove('shake-animation');
      }, 500);
    }
  };

  const birthdayCards = [
    {
      id: 1,
      theme: 'blue',
      date: 'May 12, 2023',
      image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d',
      message: 'May your birthday be as wonderful and unique as you are!',
      sender: 'Your Smiya Friends'
    },
    {
      id: 2,
      theme: 'purple',
      date: 'June 23, 2023',
      image: 'https://images.unsplash.com/photo-1611048661702-7b55eed346b4',
      message: 'Another year of amazing adventures awaits you. Happy Birthday!',
      sender: 'The Smiya Team'
    },
    {
      id: 3,
      theme: 'green',
      date: 'August 4, 2023',
      image: 'https://images.unsplash.com/photo-1612540139150-4c5f872a2cd3',
      message: 'Wishing you a day filled with happiness and a year filled with joy!',
      sender: 'Your Smiya Family'
    },
    {
      id: 4,
      theme: 'orange',
      date: 'October 17, 2023',
      image: 'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec',
      message: 'May today be the start of a wonderful, glorious and joyful year to come.',
      sender: 'Everyone at Smiya'
    },
    {
      id: 5,
      theme: 'pink',
      date: 'December 5, 2023',
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
      {(showPopups || showHeartAnimation) && (
        <>
          <div className="blur-overlay"></div>

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
              <g transform={`translate(${window.innerWidth/2}, ${window.innerHeight/2})`}>
                <path
                  d={`M ${heartPositions[0].x * scale} ${heartPositions[0].y * scale}
                      ${heartPositions.slice(1).map(point => `L ${point.x * scale} ${point.y * scale}`).join(' ')}
                      Z`}
                  fill="#ff69b4"
                  className="heart-fill"
                  style={{ transformOrigin: 'center' }}
                />
              </g>
            )}
          </svg>

          {showPopups && popupPositions.map((pos, index) => (
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

      <div className="birthday-timeline">
        <div className="timeline-line"></div>
        
        {birthdayCards.map((card, index) => (
          <div 
            key={card.id} 
            className={`timeline-item ${index % 2 === 0 ? 'left-item' : 'right-item'}`}
          >
            <div className="timeline-date">{card.date}</div>
            <div className="timeline-dot"></div>
            <div
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
              </div>
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
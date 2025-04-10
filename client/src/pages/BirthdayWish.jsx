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
  const [isMuted, setIsMuted] = useState(true); // Start muted for better UX
  const videoRef = useRef(null);
  const [lastHeartPosition, setLastHeartPosition] = useState({ x: 0, y: 0 });
  const [trailActive, setTrailActive] = useState(false);
  const minHeartDistance = 30; // Minimum distance between hearts in pixels

  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  // Update viewport dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    { title: "Are you the most cutest girl?", yesText: "Yes", noText: "No" },
    { title: "Are you the most pretiest girl?", yesText: "Yes", noText: "No" },
    { title: "Are you the most gorgeous girl", yesText: "Yes", noText: "No" },
    { title: "Are you the most beautifull girl?", yesText: "Yes", noText: "No" },
    { title: "Are you Smit's Wife?", yesText: "Yes", noText: "No" },
    { title: "Heart completed!!!", yesText: "Yes", noText: "No" }
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
    const handleScroll = () => {
      requestAnimationFrame(() => {
        cards.current.forEach(card => {
          // Get card's position relative to the viewport
          const rect = card.getBoundingClientRect();
          const cardCenter = rect.top + (rect.height / 2);
          
          // Calculate how far the card is from the optimal viewing position (center of screen)
          const distanceFromCenter = Math.abs(cardCenter - viewportHeight / 2);
          const maxDistance = viewportHeight * 0.8; // Max distance to consider
          
          // Calculate visibility ratio - 1 when at center, 0 when at max distance
          const visibilityRatio = 1 - Math.min(distanceFromCenter / maxDistance, 1);
          
          // Apply transform and opacity based on distance
          card.style.opacity = 0.4 + (visibilityRatio * 0.6);
          card.style.transform = `scale(${0.8 + (visibilityRatio * 0.2)})`;
          
          // Add/remove visible class based on visibility threshold
          if (visibilityRatio > 0.2) {
            card.classList.add('card-visible');
          } else {
            card.classList.remove('card-visible');
          }
        });
      });
    };
    
    // Initial check
    handleScroll();
    
    // Add scroll event listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [viewportHeight]); // Add viewportHeight as dependency

  useEffect(() => {
    // Attempt to play the video when component mounts
    const videoElement = videoRef.current;
    
    if (videoElement) {
      // Set volume to ensure it's not at zero
      videoElement.volume = 0.5;
      
      // Log info about audio tracks
      console.log('Audio tracks:', videoElement.audioTracks ? videoElement.audioTracks.length : 'not supported');
      
      const playPromise = videoElement.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Background video playback started');
          })
          .catch(error => {
            console.warn('Auto-play was prevented:', error);
            setIsMuted(true); // Ensure muted if autoplay was blocked
          });
      }
    }
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.muted = isMuted;
      
      // Log the current state to help debug
      console.log(`Video muted state: ${videoElement.muted}, isMuted state: ${isMuted}`);
      
      // If unmuting, ensure volume is not zero
      if (!isMuted) {
        videoElement.volume = 0.5;
      }
    }
  }, [isMuted]);

  const toggleSound = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.muted = newMutedState;
      
      // When unmuting, we need to make sure user interaction is registered
      if (!newMutedState) {
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Error unmuting video:", error);
            // If unmuting fails, revert to muted
            setIsMuted(true);
          });
        }
      }
    }
  };

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
      date: 'April 10 2005',
      image: '/photos/10-4-05.jpg',
      header: 'Angel On Earth',
      message: 'This is the day when my cutuu was born and world became more beautifull.',
      sender: 'Your Lover'
    },
    {
      id: 2,
      theme: 'purple',
      date: 'April 07, 2022',
      image: '/photos/7-4-22.jpg',
      header: 'First Meeting',
      message: 'The day when we first time saw our soulmates.',
      sender: 'Your Baby'
    },
    {
      id: 3,
      theme: 'green',
      date: 'October 03, 2022',
      image: '/photos/3-10-22.jpg',
      header: 'My Confession',
      message: 'I was so mad in love with you that I could not resist more on keeping it to myself',
      sender: 'Your Hubby'
    },
    {
      id: 4,
      theme: 'orange',
      date: 'August 28, 2023',
      image: '/photos/28-8-23.jpg',
      header: 'Your Confession',
      message: 'The best day of my life to know that its not one sided anymore',
      sender: 'Your Soulmate'
    },
    {
      id: 5,
      theme: 'pink',
      date: 'September 12, 2023',
      image: '/photos/12-9-23.jpg',
      header: 'Your Proposal',
      message: 'That was the day when you said love you to me and made my life complete.',
      sender: 'Your Better Half'
    },
    {
      id: 6,
      theme: 'pink',
      date: 'November 7, 3',
      image: '/photos/7-11-23.jpg',
      header: 'First Date',
      message: 'Took a bit time to change from friends to lovers but we made it at the end of the day',
      sender: 'Father of your children'
    },
    {
      id: 7,
      theme: 'pink',
      date: 'November 22, 2023',
      image: '/photos/22-11-23.jpg',  // Update with actual file name if available
      header: 'My Birthday',
      message: 'Proposed you in live properly. Watched movie together for the first time.',
      sender: 'With love from your love'
    }, 
    {
      id: 8,
      theme: 'pink',
      date: 'Jan 3, 2024',
      image: '/photos/3-1-24.jpg',  // Update with actual file name if available
      header: 'First Kiss',
      message: 'It was pure love which made us to kiss each other.',
      sender: 'Your cutuu'
    },
    {
      id: 9,
      theme: 'pink',
      date: 'March 22, 2024',
      image: '/photos/22-3-24.jpg',  // Update with actual file name if available
      header: 'Our Home',
      message: 'Really gave complete feeling of you being my wife',
      sender: 'Your Naughty'
    },
    {
      id: 10,
      theme: 'pink',
      date: 'March 27, 2024',
      image: '/photos/27-3-23.jpg',  // Update with actual file name if available
      header: 'Shopping, Mandir and Holi',
      message: 'Did first time shopping together, Went Mandir together for first time and the played holi for the first time',
      sender: 'Your paglu'
    },
    {
      id: 11,
      theme: 'pink',
      date: 'September 12, 2024',
      image: '/photos/12-9-24.jpg',  // Update with actual file name if available
      header: 'First Anniversary',
      message: 'Came all the way from surat to celebrate our First Anniversary together',
      sender: 'Your paglu'
    }
  ];

  const addToRefs = (el) => {
    if (el && !cards.current.includes(el)) {
      cards.current.push(el);
    }
  };

  const setCardTransformOrigin = (el, isLeftItem) => {
    if (el) {
      // Set initial state before any animations occur
      el.classList.add('card-initial');
      
      // Add to refs for intersection observation
      addToRefs(el);
      
      // Return the combined ref function
      return el;
    }
  };

  // Improved heart trail animation
  const createHeartTrail = (e) => {
    if (showPopups || showHeartAnimation) return;
    
    const currentPosition = { x: e.clientX, y: e.clientY };
    
    // Calculate distance from last heart position
    const distance = Math.sqrt(
      Math.pow(currentPosition.x - lastHeartPosition.x, 2) + 
      Math.pow(currentPosition.y - lastHeartPosition.y, 2)
    );
    
    // Only create a new heart if we've moved far enough
    if (distance > minHeartDistance || !trailActive) {
      setLastHeartPosition(currentPosition);
      setTrailActive(true);
      
      const heart = document.createElement('div');
      heart.className = 'heart-trail';
      heart.innerHTML = '❤';
      heart.style.position = 'fixed'; // Use fixed instead of absolute
      heart.style.left = `${currentPosition.x}px`;
      heart.style.top = `${currentPosition.y}px`;
      heart.style.fontSize = `${16 + Math.random() * 10}px`; // Random size variation
      heart.style.color = 'var(--primary-pink)';
      heart.style.opacity = '0.9';
      heart.style.pointerEvents = 'none';
      heart.style.zIndex = '999';
      heart.style.transform = 'translateY(0)';
      heart.style.transition = 'transform 1s ease-out, opacity 1s ease-out';
      
      // Add to document
      document.body.appendChild(heart);
      
      // Start animation after a small delay
      setTimeout(() => {
        heart.style.transform = `translateY(-${20 + Math.random() * 30}px) rotate(${Math.random() * 30 - 15}deg)`;
        heart.style.opacity = '0';
      }, 10);
      
      // Remove the heart after animation completes
      setTimeout(() => {
        if (document.body.contains(heart)) {
          document.body.removeChild(heart);
        }
      }, 1100);
    }
  };

  // Ensure popups stay within viewport bounds
  const getConstrainedPosition = (position, index) => {
    // Use state variables instead of accessing window properties directly
    // const viewportWidth = window.innerWidth;
    // const viewportHeight = window.innerHeight;
    
    // Estimate popup dimensions (scaled)
    const popupWidth = 250 * scale;
    const popupHeight = 180 * scale; // Approximate height
    
    // Calculate boundaries (with some padding)
    const padding = 20;
    const maxX = (viewportWidth / 2) - (popupWidth / 2) - padding;
    const maxY = (viewportHeight / 2) - (popupHeight / 2) - padding;
    
    // Constrain position values
    const constrainedX = Math.max(-maxX, Math.min(maxX, position.x));
    const constrainedY = Math.max(-maxY, Math.min(maxY, position.y));
    
    return {
      x: constrainedX,
      y: constrainedY
    };
  };

  return (
    <div className="birthday-container" ref={containerRef} onMouseMove={createHeartTrail}>
      <div className="video-background">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted={isMuted}
          playsInline
        >
          <source src="/videos/birthday-background.mp4" type="video/mp4" />
          Your browser does not support video backgrounds.
        </video>
      </div>
      
      <button 
        className="sound-toggle"
        onClick={toggleSound}
        aria-label={isMuted ? "Unmute background music" : "Mute background music"}
        style={{ 
          zIndex: 1003,
          position: "fixed",
          bottom: "20px",
          left: "20px",
          pointerEvents: "auto" // Explicitly set pointer events
        }}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

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
              <g transform={`translate(${viewportWidth/2}, ${viewportHeight/2})`}>
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

          {showPopups && popupPositions.map((pos, index) => {
            // Get constrained position within viewport
            const safePos = getConstrainedPosition(pos, index);
            
            return visitedPopups.includes(index) && (
              <div
                key={`popup-${index}`}
                className={`birthday-popup ${index !== activePopupIndex ? 'inactive-popup' : ''} ${index % 2 === 0 ? 'cyan-popup' : 'pink-popup'}`}
                style={{
                  position: 'fixed',
                  top: `calc(50% + ${safePos.y}px)`,
                  left: `calc(50% + ${safePos.x}px)`,
                  transform: 'translate(-50%, -50%)',
                  maxWidth: `${Math.min(250 * scale, viewportWidth * 0.8)}px`,
                  padding: `${Math.max(10, 20 * scale)}px ${Math.max(15, 30 * scale)}px`,
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
          })}
        </>
      )}

      <div className="birthday-header">
        <h1>Happy Birthday Jaan</h1>
        <p>Lets look at our beautifull story which we have had so far ....</p>
        <div className="birthday-decoration">
          <span>🎂</span>
          <span>🎁</span>
          <span>🎉</span>
          <span>💗</span>
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
              ref={(el) => setCardTransformOrigin(el, index % 2 === 0)}
              className={`birthday-card card-theme-${card.theme}`}
            >
              <div className="card-image">
                <img 
                  src={card.image} 
                  alt={card.header} 
                  loading="lazy"
                  className="responsive-image"
                />
              </div>
              <div className="card-content">
                <div className="confetti">
                  <span>💗</span>
                  <span>✨</span>
                  <span>❤️</span>
                </div>
                <h3>{card.header}</h3>
                <p className="card-message">{card.message}</p>
                <p className="card-sender">- {card.sender}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="create-wish-section">
        <h2>Happy Birthdday Once Again !!!</h2>
        <p>Will be making more such memories in the upcoming years 🫂❤️</p>
      </div>
    </div>
  );
}

export default BirthdayWish;
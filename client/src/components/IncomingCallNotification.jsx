import React, { useState, useEffect } from 'react';
import '../styles/IncomingCallNotification.css';

const IncomingCallNotification = ({ callData, onAccept, onReject }) => {
  const { fromUsername, callId } = callData;
  const [timeLeft, setTimeLeft] = useState(30); // 30 second countdown
  
  // Add countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      onReject(callData);
      return;
    }
    
    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [timeLeft, callData, onReject]);
  
  return (
    <div className="global-incoming-call">
      <div className="incoming-call-content">
        <h3>Incoming call from {fromUsername || 'Unknown'}</h3>
        <p className="call-timer">Auto-declining in {timeLeft} seconds</p>
        <div className="call-actions">
          <button className="answer-call" onClick={() => onAccept(callData)}>
            <span className="call-icon">✓</span> Accept
          </button>
          <button className="reject-call" onClick={() => onReject(callData)}>
            <span className="call-icon">✕</span> Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallNotification;
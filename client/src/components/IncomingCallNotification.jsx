// components/IncomingCallNotification.jsx
import React from 'react';
import '../styles/IncomingCallNotification.css';

const IncomingCallNotification = ({ callData, onAccept, onReject }) => {
  const { fromUsername } = callData;
  
  return (
    <div className="global-incoming-call">
      <div className="incoming-call-content">
        <h3>Incoming call from {fromUsername || 'Unknown'}</h3>
        <div className="call-actions">
          <button className="answer-call" onClick={() => onAccept(callData)}>Accept</button>
          <button className="reject-call" onClick={() => onReject(callData)}>Reject</button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallNotification;
// VideoCall.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import CallerVideo from './CallerVideo';
import ReceiverVideo from './ReceiverVideo';

function VideoCall() {
  const location = useLocation();
  const { recipientId, callerInfo } = location.state || {};
  
  // Determine call role based on provided state
  const isCaller = !!recipientId;
  const isReceiver = !!callerInfo;

  // Render appropriate component based on role
  if (isCaller) {
    return <CallerVideo />;
  } else if (isReceiver) {
    return <ReceiverVideo />;
  } else {
    // Fallback for invalid context - will auto-redirect in useEffect
    return <div className="video-call-container">Redirecting...</div>;
  }
}

export default VideoCall;
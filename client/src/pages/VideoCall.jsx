// VideoCall.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import CallerVideo from './CallerVideo';
import ReceiverVideo from './ReceiverVideo';

function VideoCall() {
  const location = useLocation();
  const { recipientId, callerInfo } = location.state || {};
  
  // If we have recipientId, we're the caller
  // If we have callerInfo, we're the receiver
  const isCaller = !!recipientId;
  const isReceiver = !!callerInfo;

  if (isCaller) {
    return <CallerVideo />;
  } else if (isReceiver) {
    return <ReceiverVideo />;
  } else {
    // No valid context, render a placeholder that will redirect
    return <div className="video-call-container">Redirecting...</div>;
  }
}

export default VideoCall;
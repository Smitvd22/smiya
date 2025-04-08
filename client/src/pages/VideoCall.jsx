// VideoCall.jsx
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CallerVideo from './CallerVideo';
import ReceiverVideo from './ReceiverVideo';
import ErrorBoundary from '../components/ErrorBoundary'; // You'll need to create this component

function VideoCall() {
  const location = useLocation();
  const navigate = useNavigate();
  const { recipientId, callerInfo } = location.state || {};
  const [hasError, setHasError] = useState(false);
  
  console.log("VideoCall: Rendering with state:", { 
    recipientId, 
    callerInfo, 
    isCaller: !!recipientId, 
    isReceiver: !!callerInfo 
  });
  
  // Enhanced role determination
  const isCaller = !!recipientId;
  const isReceiver = !!callerInfo;
  
  // Store pre-call path when component mounts
  useEffect(() => {
    if (isCaller || isReceiver) {
      // Store current path to return to after call ends
      sessionStorage.setItem('preCallPath', document.referrer || '/chat');
      console.log('Stored pre-call path:', document.referrer || '/chat');
    }
  }, [isCaller, isReceiver]);
  
  // Ensure we redirect if landing on this page without proper state
  useEffect(() => {
    if (!isCaller && !isReceiver) {
      console.log("VideoCall: No valid state, redirecting back");
      const timer = setTimeout(() => {
        navigate(-1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isCaller, isReceiver, navigate]);

  // Error handling function
  const handleComponentError = (error) => {
    console.error("Video call component error:", error);
    setHasError(true);
    setTimeout(() => navigate(-1), 2000);
  };

  if (hasError) {
    return (
      <div className="video-call-container error">
        <h3>Video Call Error</h3>
        <p>There was a problem establishing the video call.</p>
        <button onClick={() => navigate(-1)}>Return to Chat</button>
      </div>
    );
  }

  // Enhanced safe component selection with error boundary
  return (
    <ErrorBoundary onError={handleComponentError}>
      {isCaller ? (
        <CallerVideo />
      ) : isReceiver ? (
        <ReceiverVideo />
      ) : (
        <div className="video-call-container">Redirecting to previous page...</div>
      )}
    </ErrorBoundary>
  );
}

export default VideoCall;
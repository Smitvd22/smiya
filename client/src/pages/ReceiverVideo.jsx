import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCall } from '../contexts/CallContext';
import { createPeer } from '../utils/webrtc';
import VideoCallInterface from '../components/VideoCallInterface';
import { useVideoCallCommon } from './VideoCallCommon';
import '../styles/VideoCall.css';

const ReceiverVideo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationCallerInfo = location.state?.callerInfo;
  
  // Call context - FIXED: Only destructure what's actually available from context
  const { socket, callerInfo: contextCallerInfo } = useCall();
  
  // Use a local state to manage call state within component
  const [localCallState, setLocalCallState] = useState('idle');
  
  // Use the caller info from location state or context
  const callerInfo = locationCallerInfo || contextCallerInfo;
  
  // Common video call hooks and state
  const {
    stream,
    // setStream,
    callError,
    connectionStatus,
    // socketConnected,
    isAudioEnabled,
    isVideoEnabled,
    // streamInitialized,
    myVideo,
    userVideo,
    socketRef,
    connectionRef,
    isComponentMounted,
    setCallError,
    setupConnectionListeners,
    toggleAudio,
    toggleVideo,
    cleanupResources,
    initializeStream,
    setCallState
  } = useVideoCallCommon();
  
  // Local refs for this component
  const pendingCandidates = useRef([]);
  const hasAutoAccepted = useRef(false);
  const callEndTimeoutRef = useRef(null);
  
  // IMPORTANT: Define endCallHandler FIRST before it's referenced by other functions
  const endCallHandler = useCallback(() => {
    if (!isComponentMounted.current) return;
    
    console.log("Ending call - setting state to ending");
    setLocalCallState('ending');
    
    // Set shared state if available
    if (typeof setCallState === 'function') {
      setCallState('ending');
    }
    
    if (socketRef.current && callerInfo) {
      console.log(`Sending end-call signal to ${callerInfo.id}`);
      socketRef.current.emit('end-call', {
        to: callerInfo.id
      }, (ack) => {
        console.log("Server acknowledged end-call:", ack);
      });
    }
    
    // Move to cleanup phase
    console.log("Moving to resource cleanup phase");
    cleanupResources();
    
    // Navigate back after short delay
    setTimeout(() => {
      if (isComponentMounted.current) {
        console.log("Navigating back after call end");
        navigate(-1);
      }
    }, 1000);
  }, [callerInfo, socketRef, cleanupResources, navigate, isComponentMounted, setCallState]);
  
  // NOW define answerCall AFTER endCallHandler
  const answerCall = useCallback(async () => {
    console.log("ReceiverVideo: answerCall called with callerInfo:", callerInfo);
    
    // Return early if we already have a connection
    if (connectionRef.current) {
      console.log("Connection already exists, ignoring duplicate answer attempt");
      return;
    }
    
    try {
      // Set call as active in both local and context state
      setLocalCallState('active');
      
      // Set shared state if available
      if (typeof setCallState === 'function') {
        setCallState('active');
      }
      
      console.log("Answering call - attempting to establish connection");
      
      // Try to get stream but continue even if it fails
      let mediaStream = stream;
      
      if (!mediaStream) {
        console.log("No stream yet, attempting to get user media with retries...");
        try {
          // First try with both audio and video
          mediaStream = await initializeStream(true, true);
        } catch (err) {
          console.warn("Error with video+audio:", err);
          try {
            // Try with audio only
            mediaStream = await initializeStream(true, false);
            console.log("Successfully got audio-only stream");
          } catch (audioErr) {
            console.error("Error with audio-only:", audioErr);
            // Create empty fallback stream to ensure call can continue
            mediaStream = new MediaStream();
            setCallError("Joining with limited media access");
          }
        }
      }
      
      if (!isComponentMounted.current) {
        console.log("Component unmounted during answerCall");
        return;
      }
      
      if (!callerInfo || !callerInfo.signal) {
        console.error("Missing caller signal data");
        setCallError("Cannot answer - missing connection data");
        return;
      }

      console.log("Creating receiver peer with signal:", callerInfo.signal);
      
      // Create peer connection with explicit error handling
      const peer = createPeer(false, mediaStream);
      console.log("Created receiver peer");
      
      // Set up connection listeners before signaling
      setupConnectionListeners(peer);

      // Process the offer signal
      peer.signal(callerInfo.signal);
      
      // Save connection reference
      connectionRef.current = peer;

      // Process any pending ICE candidates
      if (pendingCandidates.current.length > 0) {
        console.log(`Processing ${pendingCandidates.current.length} pending ICE candidates`);
        pendingCandidates.current.forEach(candidate => {
          peer.signal(candidate);
        });
        pendingCandidates.current = [];
      }

      // Send answer back to caller
      peer.on('signal', signal => {
        console.log("Generated answer signal:", signal.type || "ICE candidate");
        if (socketRef.current && callerInfo) {
          console.log(`Sending answer signal to ${callerInfo.id}`);
          socketRef.current.emit('signal-update', {
            to: callerInfo.id,
            signal: signal,
            from: socket.id
          });
        }
      });
      
      // Handle incoming stream
      peer.on('stream', incomingStream => {
        console.log("Received incoming stream from caller");
        if (userVideo.current && isComponentMounted.current) {
          userVideo.current.srcObject = incomingStream;
        }
      });

    } catch (err) {
      console.error("Error answering call:", err);
      setCallError(`Connection error: ${err.message}`);
    }
  }, [callerInfo, connectionRef, stream, initializeStream, isComponentMounted, 
      setupConnectionListeners, setCallError, setCallState, socketRef, userVideo, socket?.id]);

  // Handle user accepting the call manually
  const handleAcceptCall = () => {
    console.log("User manually accepted call");
    answerCall();
  };
  
  // Handle user rejecting the call - FIXED: Check if setCallState exists
  const handleRejectCall = () => {
    console.log('Rejecting incoming call');
    setLocalCallState('rejected');
    
    // Set shared state if available
    if (typeof setCallState === 'function') {
      setCallState('rejected');
    }
    
    if (socketRef.current && callerInfo) {
      socketRef.current.emit('reject-call', {
        to: callerInfo.id
      });
    }
    
    // Navigate back after short delay
    setTimeout(() => {
      if (isComponentMounted.current) {
        navigate(-1);
      }
    }, 500);
  };
  
  // Set initial call state when component mounts - FIXED: Check if setCallState exists
  useEffect(() => {
    if (locationCallerInfo) {
      console.log('ReceiverVideo: Received caller info:', locationCallerInfo);
      // Set local call state
      setLocalCallState('receiving');
      
      // Set shared state if available
      if (typeof setCallState === 'function') {
        setCallState('receiving');
      }
      console.log('ReceiverVideo: Setting call state to receiving');
    }
  }, [locationCallerInfo, setCallState]);

  // Auto-accept logic with improved timing and debugging
  useEffect(() => {
    if (locationCallerInfo && locationCallerInfo.autoAccept && 
        localCallState === 'receiving' && !hasAutoAccepted.current) {
      console.log('ReceiverVideo: Auto-accept condition met');
      hasAutoAccepted.current = true;
      
      // Extend delay for component to fully initialize
      const timer = setTimeout(() => {
        if (isComponentMounted.current) {
          console.log('ReceiverVideo: Auto-accepting call');
          answerCall();
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [locationCallerInfo, localCallState, isComponentMounted, answerCall]);
  
  // Handle component unmount
  useEffect(() => {
    // Store ref value in a variable inside the effect
    const currentTimeoutRef = callEndTimeoutRef.current;
    
    return () => {
      if (currentTimeoutRef) {
        clearTimeout(currentTimeoutRef);
      }
    };
  }, []);
  
  // Handle signal updates
  useEffect(() => {
    if (!socketRef.current || !callerInfo) return;
    
    // Store the socketRef value inside this effect
    const currentSocketRef = socketRef.current;
    
    const handleSignalUpdate = (data) => {
      if (!callerInfo || data.from !== callerInfo.id) return;
      
      console.log("Received signal update:", data.signal?.type || "ICE candidate");
      
      if (connectionRef.current) {
        try {
          connectionRef.current.signal(data.signal);
          console.log("Processed incoming signal");
        } catch (err) {
          console.error("Error processing signal:", err);
        }
      } else {
        console.log("Buffering ICE candidate until peer is ready");
        pendingCandidates.current.push(data.signal);
      }
    };
    
    const handleCallEnded = () => {
      console.log("Call ended by other user");
      setCallError('Call ended by other user');
      endCallHandler();
    };
    
    currentSocketRef.on('call-signal-update', handleSignalUpdate);
    currentSocketRef.on('call-ended', handleCallEnded);
    
    return () => {
      if (currentSocketRef) {
        currentSocketRef.off('call-signal-update', handleSignalUpdate);
        currentSocketRef.off('call-ended', handleCallEnded);
      }
    };
  }, [socketRef, callerInfo, connectionRef, endCallHandler, setCallError]);
  
  // Handle call interface rendering based on local call state
  const renderCallInterface = () => {
    console.log(`Rendering interface for state: ${localCallState}`);
    
    switch (localCallState) {
      case 'receiving':
        return (
          <div className="call-actions">
            <h2>Incoming call from {callerInfo?.fromUsername || 'Unknown'}</h2>
            <div className="call-buttons">
              <button onClick={handleAcceptCall} className="accept-call">Accept</button>
              <button onClick={handleRejectCall} className="reject-call">Reject</button>
            </div>
          </div>
        );
      
      case 'active':
      case 'ending':
        return (
          <VideoCallInterface
            stream={stream}
            myVideo={myVideo}
            userVideo={userVideo}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            toggleAudio={toggleAudio}
            toggleVideo={toggleVideo}
            endCall={endCallHandler}
            callError={callError}
            connectionStatus={connectionStatus}
            userName={callerInfo?.fromUsername || 'User'}
            callState={localCallState}
          />
        );
      
      default:
        return <div>Initializing call...</div>;
    }
  };
  
  return (
    <div className="video-call-container">
      {renderCallInterface()}
    </div>
  );
};

export default ReceiverVideo;
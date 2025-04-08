// ReceiverVideo.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { createPeer } from '../utils/webrtc';
import { useVideoCallCommon } from './VideoCallCommon';
import VideoCallInterface from '../components/VideoCallInterface';

function ReceiverVideo() {
  const location = useLocation();
  const { callerInfo: locationCallerInfo } = location.state || {};
  const [callerInfo, setCallerInfo] = useState(locationCallerInfo || null);
  
  const {
    stream,
    callState,
    setCallState,
    callError,
    setCallError,
    isAudioEnabled,
    isVideoEnabled,
    myVideo,
    userVideo,
    connectionRef,
    socketRef,
    isComponentMounted,
    setupConnectionListeners,
    toggleAudio,
    toggleVideo,
    initializeStream,
    navigate,
    endCallHandler
  } = useVideoCallCommon();

  // Handle answering an incoming call - wrapped in useCallback
  const answerCall = useCallback(async () => {
    try {
      // Set call as active immediately
      setCallState('active');
      
      // Try to get stream but continue if not possible
      let mediaStream = stream;
      
      if (!mediaStream) {
        console.log("No stream yet, attempting to get user media...");
        try {
          mediaStream = await initializeStream();
        } catch (err) {
          console.error("Error initializing stream:", err);
          // Continue with empty stream
          mediaStream = new MediaStream();
          setCallError("Joining without camera/mic access");
        }
      }
      
      // Verify we have valid caller info
      if (!isComponentMounted.current || !callerInfo || !callerInfo.signal) {
        setCallError("Missing caller information");
        setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 2000);
        return;
      }
      
      console.log("Creating receiver peer");
      const peer = createPeer(
        false, // Not the initiator
        mediaStream, // Could be null or empty
        signal => {
          if (socketRef.current && callerInfo && isComponentMounted.current) {
            console.log("Answering call with signal:", signal);
            socketRef.current.emit('answer-call', { 
              signal, 
              to: callerInfo.id 
            });
          }
        },
        () => {
          console.log("Peer connection established for answerer");
          if (isComponentMounted.current) {
            setCallState('active');
          }
        },
        remoteStream => {
          console.log("Received remote stream:", remoteStream);
          if (userVideo.current && isComponentMounted.current) {
            userVideo.current.srcObject = remoteStream;
          }
        },
        () => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        },
        error => {
          console.error("Connection error:", error);
          if (isComponentMounted.current) {
            setCallError('Connection error');
            setTimeout(() => {
              if (isComponentMounted.current) {
                endCallHandler();
              }
            }, 3000);
          }
        }
      );
      
      // Store peer and add listeners
      connectionRef.current = peer;
      setupConnectionListeners(peer);
      
      // Process the incoming signal
      peer.signal(callerInfo.signal);
      
    } catch (error) {
      console.error('Failed to answer call:', error);
      setCallError('Failed to answer call');
      setTimeout(() => {
        if (isComponentMounted.current) {
          endCallHandler();
        }
      }, 3000);
    }
  }, [
    stream,
    initializeStream,
    isComponentMounted,
    callerInfo,
    setCallError,
    endCallHandler,
    socketRef,
    setCallState,
    setupConnectionListeners,
    connectionRef, // Add this missing dependency
    userVideo    // Add this missing dependency
  ]);
  
  // Handle rejecting an incoming call
  const rejectCall = () => {
    if (socketRef.current && callerInfo) {
      try {
        socketRef.current.emit('reject-call', { to: callerInfo.id });
      } catch (err) {
        console.error("Error rejecting call:", err);
      }
    }
    endCallHandler();
  };

  // Initialize media stream for receiver
  useEffect(() => {
    if (locationCallerInfo) {
      setCallState('receiving');
      // Try to initialize stream but don't block
      initializeStream().catch(err => {
        console.error("Failed to initialize stream:", err);
      });
    }
  }, [locationCallerInfo, setCallState, initializeStream]);

  // Auto-accept call if coming from notification
  useEffect(() => {
    if (locationCallerInfo && locationCallerInfo.autoAccept && callState === 'receiving') {
      // Small delay to ensure everything is properly initialized
      const timer = setTimeout(() => {
        if (isComponentMounted.current) {
          console.log('Auto-accepting call from notification');
          answerCall();
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [locationCallerInfo, callState, answerCall, isComponentMounted]);

  // Redirect if no valid call context
  useEffect(() => {
    if (!callerInfo && callState === 'idle') {
      console.log('No valid call context, redirecting back');
      const timer = setTimeout(() => {
        if (isComponentMounted.current) {
          navigate(-1);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [callerInfo, callState, navigate, isComponentMounted]);

  // Handle socket events
  useEffect(() => {
    if (!socketRef.current) {
      console.error("No socket available for event registration");
      return;
    }

    const socket = socketRef.current;
    
    const handleIncomingCall = ({ signal, from, fromUsername }) => {
      console.log(`Incoming call from ${fromUsername} (${from})`, signal);
      if (isComponentMounted.current) {
        // Store caller info but set call state directly to 'active' instead of 'receiving'
        setCallerInfo({ signal, id: from, username: fromUsername });
        setCallState('active');
        
        // Auto-accept the call with a small delay
        setTimeout(() => {
          if (isComponentMounted.current) {
            console.log('Auto-accepting incoming call');
            answerCall();
          }
        }, 300);
      }
    };
    
    const handleCallEnded = () => {
      if (isComponentMounted.current) {
        console.log("Call ended by other user");
        setCallError('Call ended by other user');
        
        // Set call state to idle FIRST
        setCallState('idle');
        
        // Use a single timeout for all cleanup
        setTimeout(() => {
          if (isComponentMounted.current) {
            // Let endCallHandler do the proper cleanup sequence
            endCallHandler();
            
            // Add a fallback navigation with longer delay
            setTimeout(() => {
              if (isComponentMounted.current && document.visibilityState !== 'hidden') {
                navigate(-1);
              }
            }, 1000);
          }
        }, 300);
      }
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-ended', handleCallEnded);
    };
  }, [callState, isComponentMounted, endCallHandler, setCallError, setCallState, socketRef, answerCall ,connectionRef , navigate]);

  // Health check interval for socket connection
  useEffect(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    
    const healthCheckInterval = setInterval(() => {
      if (socketRef.current.connected) {
        const startTime = Date.now();
        socketRef.current.volatile.emit('ping', () => {
          const latency = Date.now() - startTime;
          console.log(`Socket connection healthy, latency: ${latency}ms`);
        });
      }
    }, 10000);
    
    return () => clearInterval(healthCheckInterval);
  }, [socketRef]);

  // Override endCallHandler to ensure it has the caller ID
  const wrappedEndCallHandler = useCallback(() => {
    // Send end-call signal if needed
    if (socketRef.current?.connected && callerInfo?.id) {
      try {
        socketRef.current.emit('end-call', { to: callerInfo.id });
      } catch (err) {
        console.error("Error sending end-call:", err);
      }
    }
    
    // Set state to idle FIRST before any cleanup
    setCallState('idle');
    
    // Use original handler for cleanup
    endCallHandler();
    
    // Add navigation with delay to ensure cleanup completes
    setTimeout(() => {
      if (isComponentMounted.current) {
        navigate(-1);
      }
    }, 800);
  }, [endCallHandler, socketRef, callerInfo, setCallState, navigate, isComponentMounted]);

  return (
    <VideoCallInterface
      myVideo={myVideo}
      userVideo={userVideo}
      stream={stream}
      isAudioEnabled={isAudioEnabled}
      isVideoEnabled={isVideoEnabled}
      toggleAudio={toggleAudio}
      toggleVideo={toggleVideo}
      endCallHandler={wrappedEndCallHandler} // Use our wrapped handler
      callError={callError}
      callState={callState}
      callerInfo={callerInfo}
      answerCall={answerCall}
      rejectCall={rejectCall}
    />
  );
}

export default ReceiverVideo;
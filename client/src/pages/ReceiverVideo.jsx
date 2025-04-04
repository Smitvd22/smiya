// ReceiverVideo.jsx
import React, { useState, useEffect } from 'react';
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
    setStream,
    callState,
    setCallState,
    callError,
    setCallError,
    isAudioEnabled,
    isVideoEnabled,
    streamInitialized,
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

  // Handle answering an incoming call
  const answerCall = async () => {
    try {
      // Set call as active immediately to update UI
      setCallState('active');
      
      // Try to get stream but continue if not possible
      let mediaStream = stream;
      
      if (!mediaStream) {
        console.log("No stream yet, attempting to get user media...");
        try {
          mediaStream = await initializeStream();
        } catch (err) {
          console.error("Error initializing stream:", err);
          // Continue without media
          setCallError("Joining without camera access");
        }
      }
      
      // Only proceed if we still have a valid context
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
        mediaStream, // Could be null
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
      
      // Log the signal we're processing
      console.log("Processing incoming signal:", callerInfo.signal);
      
      // Store the peer in ref and add listeners
      connectionRef.current = peer;
      setupConnectionListeners(peer);
      
      // Process the signal
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
  };
  
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
      // Try to initialize stream but don't block on it
      initializeStream().catch(err => {
        console.error("Failed to initialize stream:", err);
      });
    }
  }, [locationCallerInfo, setCallState, initializeStream]);

  // Safe redirect if no valid call context
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

  // Handle socket events for incoming calls
  useEffect(() => {
    if (!socketRef.current) {
      console.error("No socket available for event registration");
      return;
    }

    // Store reference to socket to use in cleanup
    const socket = socketRef.current;
    
    const handleIncomingCall = ({ signal, from, fromUsername }) => {
      console.log(`Incoming call from ${fromUsername} (${from})`, signal);
      if (isComponentMounted.current) {
        setCallState('receiving');
        setCallerInfo({ signal, id: from, username: fromUsername });
      }
    };
    
    const handleCallEnded = () => {
      if (isComponentMounted.current && callState !== 'idle') {
        setCallError('Call ended by other user');
        setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 1500);
      }
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-ended', handleCallEnded);
    };
  }, [callState, isComponentMounted, endCallHandler, setCallError, setCallState, socketRef]);

  return (
    <VideoCallInterface
      myVideo={myVideo}
      userVideo={userVideo}
      stream={stream}
      isAudioEnabled={isAudioEnabled}
      isVideoEnabled={isVideoEnabled}
      toggleAudio={toggleAudio}
      toggleVideo={toggleVideo}
      endCallHandler={endCallHandler}
      callError={callError}
      callState={callState}
      callerInfo={callerInfo}
      answerCall={answerCall}
      rejectCall={rejectCall}
    />
  );
}

export default ReceiverVideo;
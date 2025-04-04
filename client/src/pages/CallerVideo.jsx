// CallerVideo.jsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createPeer } from '../utils/webrtc';
import { getCurrentUser } from '../services/authService';
import { useVideoCallCommon } from './VideoCallCommon';
import VideoCallInterface from '../components/VideoCallInterface';

function CallerVideo() {
  const location = useLocation();
  const { recipientId } = location.state || {};
  const {
    stream,
    callState,
    setCallState,
    callError,
    setCallError,
    connectionStatus, 
    socketConnected,
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
    endCallHandler,
  } = useVideoCallCommon();

  // Set call state to 'calling' when component mounts
  useEffect(() => {
    if (recipientId) {
      setCallState('calling');
    }
  }, [recipientId, setCallState]);

  // Safe redirect if no valid call context
  useEffect(() => {
    if (!recipientId && callState === 'idle') {
      console.log('No valid call context, redirecting back');
      const timer = setTimeout(() => {
        if (isComponentMounted.current) {
          navigate(-1);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [recipientId, callState, navigate, isComponentMounted]);

  // Initialize media stream for caller
  useEffect(() => {
    if (callState !== 'idle') {
      initializeStream().catch(err => {
        console.error("Failed to initialize stream:", err);
        if (isComponentMounted.current) {
          setCallError('Unable to access media devices');
          // Continue with call attempt anyway after a delay
          setTimeout(() => {
            setCallError('');
          }, 3000);
        }
      });
    }
  }, [callState, initializeStream, isComponentMounted, setCallError]);

  // Make outgoing call when recipientId is provided
  useEffect(() => {
    if (!recipientId || callState !== 'calling' || !socketRef.current || connectionRef.current) {
      return;
    }
    
    // Wait a moment for stream to initialize, but don't block indefinitely
    const initiateCallTimeout = setTimeout(async () => {
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          setCallError('Authentication error');
          return;
        }
        
        // Try to get the stream but continue even if there's no stream
        let mediaStream;
        try {
          mediaStream = await initializeStream(true, true);
        } catch (err) {
          console.log('Proceeding with call without media:', err);
        }
        
        console.log(`Initiating call to ${recipientId}${mediaStream ? ' with stream' : ' without stream'}`);
        
        if (!socketRef.current.connected) {
          setCallError('Server connection lost');
          setTimeout(() => endCallHandler(), 3000);
          return;
        }
        
        // Create the peer connection
        const peer = createPeer(
          true, // Is the initiator 
          mediaStream, // Can be null/empty
          signal => {
            if (socketRef.current && socketRef.current.connected && isComponentMounted.current) {
              console.log(`Emitting call-user to ${recipientId}`);
              socketRef.current.emit('call-user', {
                userId: recipientId,
                signalData: signal,
                from: currentUser.id,
                fromUsername: currentUser.username
              });
            } else {
              console.error("Cannot emit call-user: Socket not connected");
              setCallError("Connection to server lost");
            }
          },
          () => {
            console.log("Peer connection established for caller");
            setCallState('active');
          },
          remoteStream => {
            console.log("Received remote stream");
            if (userVideo.current && isComponentMounted.current) {
              userVideo.current.srcObject = remoteStream;
            }
          },
          () => {
            console.log("Peer connection closed");
            if (isComponentMounted.current) {
              endCallHandler();
            }
          },
          error => {
            console.error("Peer error:", error);
            if (isComponentMounted.current) {
              setCallError('Connection failed');
              setTimeout(() => {
                if (isComponentMounted.current) {
                  endCallHandler();
                }
              }, 3000);
            }
          }
        );
        
        connectionRef.current = peer;
        setupConnectionListeners(peer);
      } catch (error) {
        console.error('Failed to initiate call:', error);
        setCallError('Failed to initiate call');
        setTimeout(() => endCallHandler(), 3000);
      }
    }, streamInitialized ? 0 : 1000);
    
    // Call timeout
    const callTimeoutId = setTimeout(() => {
      if (callState === 'calling' && isComponentMounted.current) {
        setCallError('Call timeout - no answer');
        endCallHandler();
      }
    }, 30000);

    return () => {
      clearTimeout(initiateCallTimeout);
      clearTimeout(callTimeoutId);
    };
  }, [
    recipientId, 
    callState, 
    streamInitialized,
    endCallHandler,
    setupConnectionListeners,
    isComponentMounted,
    userVideo,
    connectionRef,
    socketRef,
    initializeStream,
    setCallError,
    setCallState
  ]);

  // Handle socket events for calls
  useEffect(() => {
    if (!socketRef.current) return;
    
    // Store a reference to the current socket to use in cleanup
    const socket = socketRef.current;
    
    const handleCallAccepted = (signal) => {
      if (!connectionRef.current) {
        console.log("Connection reference is null, cannot process accepted call");
        return;
      }
      
      if (isComponentMounted.current) {
        try {
          console.log("Call accepted, receiving signal:", signal);
          connectionRef.current.signal(signal);
          setCallState('active');
        } catch (err) {
          console.error("Error handling accepted call:", err);
          // Gracefully handle the error rather than letting it crash
          setCallError('Connection error');
          setTimeout(() => endCallHandler(), 2000);
        }
      }
    };

    const handleCallRejected = () => {
      if (isComponentMounted.current) {
        setCallError('Call was declined');
        endCallHandler();
      }
    };

    const handleCallEnded = () => {
      if (isComponentMounted.current) {
        setCallError('Call ended by other user');
        endCallHandler();
      }
    };

    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);

    return () => {
      // Make sure socket still exists before removing listeners
      if (socket) {
        socket.off('call-accepted', handleCallAccepted);
        socket.off('call-rejected', handleCallRejected);
        socket.off('call-ended', handleCallEnded);
      }
    };
  }, [endCallHandler, setCallError, setCallState, socketRef, connectionRef, isComponentMounted]);

  // Show connection status in UI if needed
  const connectionStatusDisplay = socketConnected ? 
    (connectionStatus === 'connected' ? 'Connected' : 'Connecting...') : 
    'Disconnected';

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
      connectionStatus={connectionStatusDisplay}
      // Pass null functions for caller (not needed but avoids prop errors)
      callerInfo={null}
      answerCall={null}
      rejectCall={null}
    />
  );
}

export default CallerVideo;
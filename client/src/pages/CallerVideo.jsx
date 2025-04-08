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
    connectionStatus, // Now used in VideoCallInterface
    socketConnected,  // Now used in VideoCallInterface
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

  // Set call state to 'calling'
  useEffect(() => {
    if (recipientId) {
      setCallState('calling');
    }
  }, [recipientId, setCallState]);

  // Redirect if no valid call context
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
      // Initialize stream but don't block if permissions not granted
      initializeStream(true, true).catch(err => {
        console.error("Failed to initialize stream:", err);
        if (isComponentMounted.current) {
          setCallError('Media access limited - others may not see/hear you');
          // Continue with call attempt anyway
          setTimeout(() => {
            if (isComponentMounted.current) {
              setCallError('');
            }
          }, 3000);
        }
      });
    }
    
    // Cleanup function to handle any stream resource issues
    return () => {
      // Cleanup handled by VideoCallCommon
    };
  }, [callState, initializeStream, isComponentMounted, setCallError]);

  // Make outgoing call when ready
  useEffect(() => {
    if (!recipientId || callState !== 'calling' || !socketRef.current || connectionRef.current) {
      return;
    }

    // Wait a moment for stream to initialize
    const initiateCallTimeout = setTimeout(async () => {
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          setCallError('Authentication error');
          return;
        }
        
        // Get stream but continue even without media
        let mediaStream = null;
        try {
          mediaStream = await initializeStream(true, true);
        } catch (err) {
          console.log('Proceeding with call without media:', err);
          // Create empty stream to avoid undefined stream errors
          mediaStream = new MediaStream();
        }
        
        console.log(`Initiating call to ${recipientId}`);
        
        if (!socketRef.current || !socketRef.current.connected) {
          setCallError('Server connection lost');
          setTimeout(() => endCallHandler(), 3000);
          return;
        }
        
        // Create peer connection with proper error handling
        try {
          // Create peer connection
          const peer = createPeer(
            true, // Is initiator
            mediaStream, // May be empty but not undefined
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
                if (isComponentMounted.current) {
                  setCallError("Connection to server lost");
                }
              }
            },
            () => {
              console.log("Peer connection established for caller");
              if (isComponentMounted.current) {
                setCallState('active');
              }
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
        } catch (peerError) {
          console.error("Error creating peer:", peerError);
          setCallError('Failed to establish connection');
          setTimeout(() => {
            if (isComponentMounted.current) {
              endCallHandler();
            }
          }, 3000);
        }
      } catch (error) {
        console.error('Failed to initiate call:', error);
        if (isComponentMounted.current) {
          setCallError('Failed to initiate call');
          setTimeout(() => {
            if (isComponentMounted.current) {
              endCallHandler();
            }
          }, 3000);
        }
      }
    }, streamInitialized ? 0 : 1000);
    
    // Call timeout
    const callTimeoutId = setTimeout(() => {
      if (callState === 'calling' && isComponentMounted.current) {
        setCallError('Call timeout - no answer');
        endCallHandler();
      }
    }, 30000); // 30 seconds timeout

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
    initializeStream,
    isComponentMounted,
    socketRef,
    setCallError,
    setCallState,
    userVideo,
    connectionRef // Added the missing dependency
  ]);

  // Handle socket events for calls
  useEffect(() => {
    if (!socketRef.current) return;
    
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
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
    };
  }, [
    endCallHandler,
    setCallError,
    setCallState,
    socketRef,
    connectionRef,
    isComponentMounted
  ]);

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
      connectionStatus={connectionStatus}  // Now passing this prop
      socketConnected={socketConnected}    // Now passing this prop
      // Pass null functions for caller (not needed)
      callerInfo={null}
      answerCall={null}
      rejectCall={null}
    />
  );
}

export default CallerVideo;
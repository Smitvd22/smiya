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
    // Use these variables to display connection status indicators in UI if needed
    connectionStatus, 
    socketConnected,
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
    endCallHandler,
    callerInfo,
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
    let localStream = null;
    
    const initStream = async () => {
      const currentStream = await initializeStream();
      if (!currentStream) {
        const timer = setTimeout(() => {
          if (isComponentMounted.current) {
            if (recipientId) {
              navigate('/chat/' + recipientId, { replace: true });
            } else {
              navigate(-1);
            }
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
      localStream = currentStream;
    };
    
    if (callState !== 'idle') {
      initStream();
    }
    
    return () => {
      if (localStream) {
        try {
          localStream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.error("Error stopping tracks on cleanup:", err);
        }
      }
    };
  }, [callState, navigate, recipientId, initializeStream, isComponentMounted]);

  // Make outgoing call when recipientId is provided and stream is ready
  useEffect(() => {
    if (!recipientId || !stream || !socketRef.current || callState !== 'calling' || connectionRef.current) {
      return;
    }

    // Add additional check for stream tracks
    if (!stream.getTracks || stream.getTracks().length === 0) {
      console.error("Stream has no tracks");
      setCallError('Camera/microphone not available');
      return;
    }

    let timeoutId;
    
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setCallError('Authentication error');
        return;
      }
      
      // Add connection timeout
      timeoutId = setTimeout(() => {
        if (callState === 'calling' && isComponentMounted.current) {
          setCallError('Call timeout - no answer');
          endCallHandler();
        }
      }, 30000); // 30 second timeout

      console.log(`Initiating call to ${recipientId} with stream:`, stream);
      console.log('Socket connected:', socketRef.current?.connected);
      
      const peer = createPeer(
        true, // Is the initiator 
        stream,
        signal => {
          if (socketRef.current && socketRef.current.connected && isComponentMounted.current) {
            console.log(`Emitting call-user to ${recipientId} with signal:`, signal);
            socketRef.current.emit('call-user', {
              userId: recipientId,
              signalData: signal,
              from: currentUser.id,
              fromUsername: currentUser.username
            });
          } else {
            console.error("Cannot emit call-user: Socket not connected", socketRef.current);
            setCallError("Connection to server lost");
          }
        },
        () => {
          console.log("Peer connection established for caller");
          setCallState('active');
        },
        remoteStream => {
          console.log("Received remote stream:", remoteStream);
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
      if (isComponentMounted.current) {
        setCallError('Failed to initiate call');
        setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 3000);
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    recipientId, 
    stream, 
    callState, 
    setCallError, 
    setCallState, 
    setupConnectionListeners, 
    isComponentMounted,
    endCallHandler,
    userVideo,
    connectionRef,
    socketRef
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
      if (socket && socket.connected) {
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
      callerInfo={callerInfo}
      connectionStatus={connectionStatusDisplay}
      // Pass null functions for caller (not needed but avoids prop errors)
      answerCall={null}
      rejectCall={null}
    />
  );
}

export default CallerVideo;
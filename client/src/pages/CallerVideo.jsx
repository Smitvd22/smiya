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
    setConnectionStatus // Added for connection health monitoring
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
            mediaStream, 
            signal => {
              if (socketRef.current && socketRef.current.connected && isComponentMounted.current) {
                // Enhanced version of emitting 'call-user'
                if (signal.type === 'offer') {
                  console.log(`Emitting initial call-user offer to ${recipientId}`);
                  
                  const sendOffer = (retries = 3) => {
                    if (!isComponentMounted.current) return;
                    
                    socketRef.current.emit('call-user', {
                      userId: recipientId,
                      signalData: signal,
                      from: currentUser.id,
                      fromUsername: currentUser.username
                    }, (ack) => {
                      if (!ack && retries > 0 && isComponentMounted.current) {
                        console.log(`Offer send retry (${retries} attempts left)`);
                        setTimeout(() => sendOffer(retries - 1), 1000);
                      }
                    });
                  };
                  
                  sendOffer();
                } else {
                  // For ICE candidates, use signal-update to avoid creating new calls
                  console.log(`Emitting signal-update (ICE candidate) to ${recipientId}`);
                  socketRef.current.emit('signal-update', {
                    to: recipientId,
                    signal: signal,
                    from: currentUser.id
                  });
                }
              } else {
                console.error("Cannot emit signal: Socket not connected");
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

          // Add this at the end of the createPeer setup
          // Send track status information when connected
          peer.on('connect', () => {
            try {
              if (mediaStream && mediaStream.getVideoTracks().length > 0) {
                const videoEnabled = mediaStream.getVideoTracks()[0].enabled;
                peer.send(JSON.stringify({
                  type: 'track-status',
                  videoEnabled,
                  audioEnabled: isAudioEnabled
                }));
                console.log(`Sent track status: video=${videoEnabled}, audio=${isAudioEnabled}`);
              }
            } catch (err) {
              console.error("Error sending track status:", err);
            }
          });
          
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
    connectionRef,
    isAudioEnabled // Added the missing dependency
  ]);

  // Extend call timeout in useEffect hook
  useEffect(() => {
    if (callState === 'calling') {
      console.log("Setting up call timeout");
      
      const callTimeoutId = setTimeout(() => {
        if (callState === 'calling' && (!connectionRef.current || !connectionRef.current.connected)) {
          setCallError('Connection taking longer than expected...');
          
          // Extend timeout instead of ending immediately
          
          const finalTimeoutId = setTimeout(() => {
            if (callState === 'calling' && (!connectionRef.current || !connectionRef.current.connected)) {
              console.log("Call connection timed out");
              endCallHandler();
            }
          }, 30000); // Additional 30s (60s total)
          
          return () => clearTimeout(finalTimeoutId);
        }
      }, 30000); // Initial 30s
      
      return () => clearTimeout(callTimeoutId);
    }
  }, [callState, connectionRef, endCallHandler, setCallError]); // Added setCallError

  // Handle socket events for calls
  useEffect(() => {
    if (!socketRef.current) return;
    
    const socket = socketRef.current;
    
    const handleCallAccepted = (signal) => {
      if (!isComponentMounted.current) return;
      
      console.log("Call accepted, received signal:", signal?.type || "ICE candidate");
      
      if (!signal) {
        console.error("Received empty signal in call-accepted");
        return;
      }
      
      console.log("Connection ref exists:", !!connectionRef.current);
      
      if (connectionRef.current) {
        try {
          // Only process answer signals if we're not already in stable state
          if (signal.type === 'answer' && connectionRef.current._pc && 
              connectionRef.current._pc.signalingState === 'have-local-offer') {
            console.log("Processing incoming answer from receiver");
            connectionRef.current.signal(signal);
          } 
          // Always process ICE candidates
          else if (signal.type === 'candidate') {
            console.log("Processing incoming ICE candidate from receiver");
            connectionRef.current.signal(signal);
          } else {
            console.log("Ignoring signal due to invalid state:", connectionRef.current._pc?.signalingState);
          }
        } catch (err) {
          console.error("Error processing incoming signal:", err);
          setCallError(`Connection error: ${err.message}`);
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
    connectionRef,
    isAudioEnabled // Add this missing dependency
  ]);

  // Monitor connection health
  useEffect(() => {
    if (!connectionRef.current || callState !== 'active') return;
    
    // Create a ping interval to check connection health
    const healthCheckInterval = setInterval(() => {
      if (connectionRef.current && typeof connectionRef.current.emit === 'function') {
        try {
          // Try to send a small ping data message
          const startTime = Date.now();
          connectionRef.current.send(JSON.stringify({type: 'ping', time: startTime}));
        } catch (err) {
          console.warn('Connection health check failed:', err);
          
          // If we detect connection issues, try reconnecting or end call
          if (isComponentMounted.current && callState === 'active') {
            setConnectionStatus('unstable');
          }
        }
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(healthCheckInterval);
  }, [connectionRef, callState, isComponentMounted, setConnectionStatus]); // Fixed dependency

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
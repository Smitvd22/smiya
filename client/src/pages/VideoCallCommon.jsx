// VideoCallCommon.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserMedia } from '../utils/webrtc';
import { getCurrentUser } from '../services/authService';
import { useCall } from '../contexts/CallContext';
import '../styles/VideoCall.css';

export const useVideoCallCommon = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useCall();
  
  // Stream and call state
  const [stream, setStream] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [callError, setCallError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const [socketConnected, setSocketConnected] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [streamInitialized, setStreamInitialized] = useState(false);
  
  // Refs
  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const connectionRef = useRef(null);
  const socketRef = useRef(socket);
  const isComponentMounted = useRef(true);
  const streamInitPromise = useRef(null);
  const reconnectionAttempts = useRef(0);
  const endCallHandlerRef = useRef(null);

  // Track component mount status
  useEffect(() => {
    isComponentMounted.current = true;
    return () => { isComponentMounted.current = false; };
  }, []);

  // Update socket reference when it changes
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // Monitor socket connection status
  useEffect(() => {
    if (!socket) {
      setSocketConnected(false);
      return;
    }

    setSocketConnected(socket.connected);
    let disconnectTimer = null;

    const handleConnect = () => {
      console.log("Socket connected in VideoCall");
      // Clear any pending disconnect timer
      if (disconnectTimer) clearTimeout(disconnectTimer);
      setSocketConnected(true);
      
      // Join personal room for receiving calls
      const currentUser = getCurrentUser();
      if (currentUser) {
        socket.emit('join-user-room', `user-${currentUser.id}`);
      }
    };

    const handleDisconnect = () => {
      console.log("Socket disconnecting in VideoCall - delaying UI update");
      // Add a delay before showing disconnection to avoid flickering
      disconnectTimer = setTimeout(() => {
        if (!socket.connected) {
          console.log("Socket confirmed disconnected after delay");
          setSocketConnected(false);
        }
      }, 2000); // 2-second delay before showing disconnect
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    if (socket.connected) handleConnect();

    return () => {
      if (disconnectTimer) clearTimeout(disconnectTimer);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  // Configure stream when available
  useEffect(() => {
    if (stream && myVideo.current) {
      myVideo.current.srcObject = stream;
    }
  }, [stream]);

  // Initialize audio/video state
  useEffect(() => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      if (audioTrack) setIsAudioEnabled(audioTrack.enabled);
      if (videoTrack) setIsVideoEnabled(videoTrack.enabled);
    }
  }, [stream]);

  // First define the reconnection logic
  const attemptReconnection = useCallback((peerId) => {
    if (!socketConnected || reconnectionAttempts.current > 3) {
      setCallError('Connection lost. Cannot reconnect.');
      setTimeout(() => {
        // Use the ref instead of direct function reference
        if (endCallHandlerRef.current) {
          endCallHandlerRef.current();
        }
      }, 3000);
      return;
    }
    
    reconnectionAttempts.current += 1;
    setConnectionStatus('reconnecting');
    
    // Re-establish connection logic would go here
    // ...
  }, [socketConnected]);

  // Then setup connection listeners with proper dependency
  const setupConnectionListeners = useCallback((peer) => {
    if (!peer) return;
    
    peer.on('connect', () => {
      if (isComponentMounted.current) {
        setConnectionStatus('connected');
        console.log("Peer connection established!");
      }
    });
    
    peer.on('error', (err) => {
      console.error("Peer connection error:", err);
      if (isComponentMounted.current) {
        setConnectionStatus('error');
        attemptReconnection(peer.id);
      }
    });
    
    peer.on('close', () => {
      console.log("Peer connection closed");
      if (isComponentMounted.current) {
        setConnectionStatus('disconnected');
      }
    });
  }, [attemptReconnection]); // Add attemptReconnection as dependency

  // Cleanup resources
  const cleanupResources = useCallback(() => {
    console.log("Cleaning up resources");
    
    // First clean up video elements
    if (myVideo.current) myVideo.current.srcObject = null;
    if (userVideo.current) userVideo.current.srcObject = null;
    
    // Then destroy peer connection with proper error handling
    if (connectionRef.current) {
      try {
        // Remove all event listeners first
        if (connectionRef.current.removeAllListeners) {
          try {
            connectionRef.current.removeAllListeners();
          } catch (err) {
            console.log("Could not remove listeners:", err);
          }
        }
        
        if (typeof connectionRef.current.destroy === 'function') {
          connectionRef.current.destroy();
        }
      } catch (err) {
        console.error("Error cleaning up connection:", err);
      } finally {
        connectionRef.current = null;
      }
    }
    
    // Then handle media streams
    if (stream) {
      try {
        stream.getTracks().forEach(track => {
          try {
            if (track.readyState === 'live') track.stop();
          } catch (e) {}
        });
      } catch (err) {
        console.error("Error stopping tracks:", err);
      }
      setStream(null);
    }
  }, [stream, myVideo, userVideo, setStream]);

  // Media controls
  const toggleAudio = useCallback(() => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [stream]);

  const toggleVideo = useCallback(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      
      if (isVideoEnabled) {
        // Currently enabled, turn off video
        videoTracks.forEach(track => {
          if (track.readyState === 'live') {
            track.stop();
          }
        });
        setIsVideoEnabled(false);
      } else {
        // Currently disabled, get a new video stream
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(videoStream => {
            // Keep existing audio track if available
            const audioTrack = stream.getAudioTracks()[0];
            
            // Create a new combined stream
            const newStream = new MediaStream();
            
            // Add the new video track
            videoStream.getVideoTracks().forEach(track => {
              newStream.addTrack(track);
            });
            
            // Add the existing audio track if available
            if (audioTrack) {
              newStream.addTrack(audioTrack);
            }
            
            // Replace the old stream with the new one
            setStream(newStream);
            
            // Update the video element
            if (myVideo.current) {
              myVideo.current.srcObject = newStream;
            }
            
            // Update the peer connection if active
            if (connectionRef.current) {
              // Remove old tracks first
              const senders = connectionRef.current.getSenders();
              senders.forEach(sender => {
                if (sender.track && sender.track.kind === 'video') {
                  connectionRef.current.removeTrack(sender);
                }
              });
              
              // Add new video track
              const newVideoTrack = videoStream.getVideoTracks()[0];
              if (newVideoTrack) {
                connectionRef.current.addTrack(newVideoTrack, newStream);
              }
            }
            
            setIsVideoEnabled(true);
          })
          .catch(err => {
            console.error("Error re-acquiring camera:", err);
            setCallError('Could not access camera');
            setTimeout(() => setCallError(''), 3000);
          });
      }
    }
  }, [stream, isVideoEnabled, myVideo, connectionRef, setCallError, setStream]);

  // Initialize media stream - with optional permissions
  const initializeStream = useCallback(async (audioEnabled = true, videoEnabled = true) => {
    // Return existing stream if available
    if (stream) return stream;
    
    // Wait for any pending initialization
    if (streamInitPromise.current) return streamInitPromise.current;
    
    console.log('Initializing media stream');
    setStreamInitialized(false);
    
    streamInitPromise.current = new Promise(async (resolve) => {
      try {
        // Get user media with requested constraints
        const currentStream = await getUserMedia({
          video: videoEnabled,
          audio: audioEnabled
        });
        
        // Handle component unmount during async operation
        if (!isComponentMounted.current) {
          if (currentStream && currentStream.getTracks) {
            currentStream.getTracks().forEach(track => track.stop());
          }
          streamInitPromise.current = null;
          resolve(null);
          return;
        }
        
        setStream(currentStream);
        setStreamInitialized(true);
        
        // Connect stream to video element
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
        
        // Apply initial track states
        if (currentStream) {
          const audioTrack = currentStream.getAudioTracks()[0];
          const videoTrack = currentStream.getVideoTracks()[0];
          
          if (audioTrack) {
            audioTrack.enabled = audioEnabled;
            setIsAudioEnabled(audioEnabled);
          }
          
          if (videoTrack) {
            videoTrack.enabled = videoEnabled;
            setIsVideoEnabled(videoEnabled);
          }
        }
        
        resolve(currentStream);
      } catch (err) {
        console.error("Media error:", err);
        
        // Create empty stream as fallback for any media error
        console.log("Creating empty stream as fallback");
        const emptyStream = new MediaStream();
        setStream(emptyStream);
        setStreamInitialized(true);
        
        // Set appropriate warning message based on error
        if (err.name === "NotReadableError") {
          setCallError('Camera/microphone in use - you can still see and hear others');
        } else if (err.name === "NotAllowedError") {
          setCallError('Permission denied - you can still see and hear others');
        } else {
          setCallError('Media access error - you can still see and hear others');
        }
        
        // Clear the error after a few seconds
        setTimeout(() => {
          if (isComponentMounted.current) {
            setCallError('');
          }
        }, 5000);
        
        // Still resolve with empty stream to allow call to proceed
        resolve(emptyStream);
      } finally {
        streamInitPromise.current = null;
      }
    });
    
    return streamInitPromise.current;
  }, [stream, setCallError, isComponentMounted, myVideo, setStream, setStreamInitialized, setIsAudioEnabled, setIsVideoEnabled]);

  // End call handler
  const endCallHandler = useCallback(() => {
    if (!isComponentMounted.current || callState === 'idle') return;
    
    console.log("Ending call");
    
    // Send end-call signal first
    if (socketRef.current && socketRef.current.connected) {
      const recipientId = location.state?.recipientId;
      const callerId = location.state?.callerInfo?.id;
      const callRecipient = recipientId || callerId;
      
      if (callRecipient) {
        try {
          socketRef.current.emit('end-call', { to: callRecipient });
        } catch (err) {
          console.error("Error emitting end-call:", err);
        }
      }
    }
    
    // Set state to idle
    setCallState('idle');
    
    // Add a small delay before cleaning up resources
    setTimeout(() => {
      if (isComponentMounted.current) {
        cleanupResources();
        
        // Navigate back
        setTimeout(() => {
          if (isComponentMounted.current) {
            navigate(-1);
          }
        }, 200);
      }
    }, 200);
  }, [cleanupResources, navigate, callState, location.state, socketRef, isComponentMounted]);
  
  // Store the handler in our ref after definition
  useEffect(() => {
    endCallHandlerRef.current = endCallHandler;
  }, [endCallHandler]);

  // Return all needed values and functions
  return {
    stream,
    setStream,
    callState,
    setCallState,
    callError,
    setCallError,
    connectionStatus,
    setConnectionStatus,
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
    cleanupResources,
    toggleAudio,
    toggleVideo,
    initializeStream,
    navigate,
    endCallHandler
  };
};

export default useVideoCallCommon;
// VideoCallCommon.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserMedia, stopMediaStream } from '../utils/webrtc';
import { getCurrentUser } from '../services/authService';
import { useCall } from '../contexts/CallContext';
import '../styles/VideoCall.css';

export const useVideoCallCommon = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useCall();
  
  const [stream, setStream] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [callError, setCallError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const [socketConnected, setSocketConnected] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [streamInitialized, setStreamInitialized] = useState(false);
  
  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const connectionRef = useRef(null);
  const socketRef = useRef(socket);
  const isComponentMounted = useRef(true);
  const streamInitPromise = useRef(null);

  // Track component mount status
  useEffect(() => {
    isComponentMounted.current = true;
    
    return () => {
      isComponentMounted.current = false;
    };
  }, []);

  // Update socket reference when it changes
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // Monitor socket status
  useEffect(() => {
    if (!socket) {
      console.error("Socket is not available from context");
      setSocketConnected(false);
      return;
    }
  
    setSocketConnected(socket.connected);
  
    const handleConnect = () => {
      console.log("Socket connected in VideoCall component");
      setSocketConnected(true);
      
      // Join user room on reconnection
      const currentUser = getCurrentUser();
      if (currentUser) {
        socket.emit('join-user-room', `user-${currentUser.id}`);
        console.log(`Joined user room: user-${currentUser.id}`);
      }
    };
  
    const handleDisconnect = () => {
      console.log("Socket disconnected in VideoCall component");
      setSocketConnected(false);
    };
  
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
  
    // Ensure we're properly connected when the component loads
    if (socket.connected) {
      handleConnect();
    }
  
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  // Set up stream for video when available
  useEffect(() => {
    if (stream && myVideo.current) {
      myVideo.current.srcObject = stream;
    }
  }, [stream]);

  // Initialize audio/video state based on initial tracks
  useEffect(() => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      if (audioTrack) setIsAudioEnabled(audioTrack.enabled);
      if (videoTrack) setIsVideoEnabled(videoTrack.enabled);
    }
  }, [stream]);

  // Setup connection listeners
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
      }
    });
    
    peer.on('close', () => {
      console.log("Peer connection closed");
      if (isComponentMounted.current) {
        setConnectionStatus('disconnected');
      }
    });

    peer.on('data', (data) => {
      console.log("Received data from peer:", data);
    });
  }, []);

  // Cleanup resources function
  const cleanupResources = useCallback(() => {
    console.log("Cleaning up resources");
    
    // First destroy the peer connection
    if (connectionRef.current) {
      try {
        const connection = connectionRef.current;
        
        // Remove all listeners first to prevent callbacks after destroy
        try {
          connection.removeAllListeners();
        } catch (err) {
          console.error("Error removing listeners:", err);
        }
        
        // Then destroy the connection
        try {
          connection.destroy();
        } catch (err) {
          console.error("Error destroying peer:", err);
        }
        
        connectionRef.current = null;
      } catch (err) {
        console.error("Error cleaning up connection:", err);
      }
    }
    
    // Then clean up media
    if (stream) {
      try {
        // Clear video elements first
        if (myVideo.current) {
          myVideo.current.srcObject = null;
        }
        if (userVideo.current) {
          userVideo.current.srcObject = null;
        }
        
        // Then stop all tracks
        if (stream.getTracks) {
          stream.getTracks().forEach(track => {
            try {
              if (track.readyState === 'live') {
                track.stop();
              }
            } catch (err) {
              console.error("Error stopping track:", err);
            }
          });
        }
        
        setStream(null);
        setStreamInitialized(false);
      } catch (err) {
        console.error("Error stopping streams:", err);
      }
    }
    
    // Reset call state
    setCallState('idle');
    setCallError('');
    setConnectionStatus('initializing');
  }, [stream, myVideo, userVideo]);

  // Controls for audio and video
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
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [stream]);

  // Initialize media stream - singleton pattern to prevent multiple simultaneous calls
  const initializeStream = useCallback(async (audioEnabled = true, videoEnabled = true) => {
    // If we already have a stream, return it
    if (stream) return stream;
    
    // If stream initialization is in progress, wait for it
    if (streamInitPromise.current) {
      return streamInitPromise.current;
    }
    
    console.log('Initializing media stream');
    setStreamInitialized(false);
    
    streamInitPromise.current = new Promise(async (resolve) => {
      try {
        // Try to get user media with specified constraints
        const currentStream = await getUserMedia({
          video: videoEnabled,
          audio: audioEnabled
        });
        
        if (!isComponentMounted.current) {
          // Component unmounted during async operation
          if (currentStream && currentStream.getTracks) {
            currentStream.getTracks().forEach(track => track.stop());
          }
          resolve(null);
          return;
        }
        
        setStream(currentStream);
        setStreamInitialized(true);
        
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
        
        // Apply initial enabled state to tracks
        if (currentStream && currentStream.getTracks) {
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
        if (isComponentMounted.current) {
          setCallError('Camera/microphone access error');
        }
        setStreamInitialized(false);
        resolve(new MediaStream()); // Return empty stream instead of null
      } finally {
        streamInitPromise.current = null;
      }
    });
    
    return streamInitPromise.current;
  }, [stream, setCallError, isComponentMounted, myVideo, setIsAudioEnabled, setIsVideoEnabled]);

  // Add this to useVideoCallCommon hook
  const endCallHandler = useCallback(() => {
    if (!isComponentMounted.current) return;
    
    // Prevent multiple cleanup triggers
    if (callState === 'idle') return;
    
    console.log("Ending call");
    
    // Send end-call signal if applicable
    if (socketRef.current && socketRef.current.connected) {
      // Use the location hook result
      const recipientId = location.state?.recipientId;
      const callerId = location.state?.callerInfo?.id;
      const callRecipient = recipientId || callerId;
      
      if (callRecipient) {
        try {
          console.log(`Emitting end-call to ${callRecipient}`);
          socketRef.current.emit('end-call', { to: callRecipient });
        } catch (err) {
          console.error("Error emitting end-call:", err);
        }
      }
    }
    
    // Set state to idle to prevent re-renders during cleanup
    setCallState('idle');
    
    // Clean up resources with a small delay
    setTimeout(() => {
      if (isComponentMounted.current) {
        cleanupResources();
        
        // Navigate back after cleanup
        setTimeout(() => {
          if (isComponentMounted.current) {
            navigate(-1);
          }
        }, 200);
      }
    }, 200);
  }, [cleanupResources, navigate, callState, location.state, socketRef, isComponentMounted]);

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
// VideoCallCommon.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserMedia } from '../utils/webrtc';
import { getCurrentUser } from '../services/authService';
import { useCall } from '../contexts/CallContext';
import '../styles/VideoCall.css';

export const useVideoCallCommon = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Properly get the location object
  const { socket } = useCall();
  
  const [stream, setStream] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [callError, setCallError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const [socketConnected, setSocketConnected] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const connectionRef = useRef(null);
  const socketRef = useRef(socket);
  const isComponentMounted = useRef(true);

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

  // Set up stream for video
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
    // First, clean up media tracks
    if (stream) {
      try {
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          try {
            if (track.readyState === 'live') {
              track.stop();
            }
          } catch (trackErr) {
            console.error("Error stopping track:", trackErr);
          }
        });
      } catch (err) {
        console.error("Error stopping media tracks:", err);
      }
      
      // Clear video element references
      if (myVideo.current) {
        myVideo.current.srcObject = null;
      }
      if (userVideo.current) {
        userVideo.current.srcObject = null;
      }
      
      setStream(null);
    }

    // Then handle peer connection cleanup
    if (connectionRef.current) {
      try {
        // Make sure we have a reference before trying to work with it
        const connection = connectionRef.current;
        
        // Remove all listeners first
        try {
          if (typeof connection.removeAllListeners === 'function') {
            connection.removeAllListeners();
          }
        } catch (err) {
          console.error("Error removing peer listeners:", err);
        }
        
        // Try to close/destroy gracefully
        try {
          if (typeof connection.destroy === 'function') {
            connection.destroy();
          }
        } catch (err) {
          console.error("Error destroying peer connection:", err);
        }
      } finally {
        // Always clear the reference
        connectionRef.current = null;
      }
    }
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

  // Initialize media stream
  const initializeStream = useCallback(async () => {
    try {
      console.log('Initializing media stream');
      const currentStream = await getUserMedia();
      
      if (!isComponentMounted.current) {
        // Component unmounted during async operation
        currentStream.getTracks().forEach(track => track.stop());
        return null;
      }
      
      setStream(currentStream);
      
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
      }
      
      return currentStream;
    } catch (err) {
      console.error("Media error:", err);
      if (isComponentMounted.current) {
        setCallError('Camera/microphone access required');
      }
      return null;
    }
  }, []);

  // Add this to useVideoCallCommon hook
  const endCallHandler = useCallback(() => {
    if (!isComponentMounted.current) return;
    
    // Prevent multiple cleanup triggers
    if (callState === 'idle') return;
    
    // First set the state to idle to prevent re-renders
    setCallState('idle');
    
    // Send end-call signal if applicable
    const currentUser = getCurrentUser();
    if (socketRef.current && socketRef.current.connected && currentUser) {
      // Use the useLocation hook result instead of direct access
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
    
    // Clean up resources with a small delay
    setTimeout(() => {
      if (isComponentMounted.current) {
        cleanupResources();
        
        // Navigate back after cleanup
        setTimeout(() => {
          if (isComponentMounted.current) {
            navigate(-1);
          }
        }, 100);
      }
    }, 100);
  }, [cleanupResources, navigate, callState, location, socketRef]);

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
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Peer } from 'peerjs';
import { useCall } from '../contexts/CallContext';
import { initializeSocket, getCurrentUser } from '../services/authService';
import '../styles/VideoCall.css';

const VideoCall = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const { socket: contextSocket } = useCall();
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasVideoPermission, setHasVideoPermission] = useState(false);
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  const [myPeerId, setMyPeerId] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Refs
  const myVideo = useRef();
  const remoteVideo = useRef();
  const myStream = useRef();
  const peerInstance = useRef();
  const currentCall = useRef();
  const isComponentMounted = useRef(true);
  const hasInitialized = useRef(false);
  const hasCleanedUp = useRef(false);
  const socketRef = useRef(null); // Local socket ref

  // Get or initialize socket
  const getSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      return socketRef.current;
    }
    
    if (contextSocket && contextSocket.connected) {
      socketRef.current = contextSocket;
      return contextSocket;
    }
    
    // Initialize socket if not available
    const user = getCurrentUser();
    if (!user) {
      navigate('/login');
      return null;
    }
    
    const socket = initializeSocket();
    if (socket) {
      socketRef.current = socket;
      return socket;
    }
    
    return null;
  }, [contextSocket, navigate]);

  const handleCallEnd = useCallback(() => {
    setConnectionStatus('disconnected');
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
  }, []);
  
  const cleanup = useCallback(() => {
    if (hasCleanedUp.current) {
      console.log('Cleanup already performed, skipping...');
      return;
    }
    
    console.log('Cleaning up video call...');
    hasCleanedUp.current = true;
    
    // Clean up media streams
    if (myStream.current) {
      myStream.current.getTracks().forEach(track => {
        track.stop();
      });
      myStream.current = null;
    }
    
    // Clean up video elements
    if (myVideo.current) {
      myVideo.current.srcObject = null;
    }
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
    
    // Close peer connection
    if (currentCall.current) {
      currentCall.current.close();
      currentCall.current = null;
    }

    // Clean up socket listeners
    if (peerInstance.current && peerInstance.current.cleanupListeners) {
      peerInstance.current.cleanupListeners();
    }
    
    if (peerInstance.current) {
      peerInstance.current.destroy();
      peerInstance.current = null;
    }
    
    // Leave the room - only once
    const socket = getSocket();
    if (socket && callId) {
      socket.emit('leave-video-call', callId);
    }
  }, [callId, getSocket]);

  const getPeerJSConfig = useCallback(() => {
    console.log('Environment:', process.env.NODE_ENV);
    
    // FIXED: Better configuration for production
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Use cloud PeerJS service for production
      return {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            { urls: 'stun:stun.relay.metered.ca:80' }
          ]
        }
      };
    }
    
    // Development configuration
    const host = process.env.REACT_APP_PEERJS_HOST || 'localhost';
    const port = parseInt(process.env.REACT_APP_PEERJS_PORT) || 9000;
    const path = process.env.REACT_APP_PEERJS_PATH || '/peerjs';
    const secure = process.env.REACT_APP_PEERJS_SECURE === 'true' || false;
    const debug = parseInt(process.env.REACT_APP_PEERJS_DEBUG) || 1;
    
    console.log('PeerJS Config:', { host, port, path, secure, debug });
    
    return {
      host,
      port,
      path,
      secure,
      debug,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    };
  }, []);

  // FIXED: Robust initialization with socket validation
  const initializeVideoCall = useCallback(async () => {
    if (hasInitialized.current || hasCleanedUp.current) {
      console.log('Video call already initialized or cleaned up, skipping...');
      return;
    }
    
    // Get socket and validate
    const socket = getSocket();
    if (!socket) {
      console.error('No socket available for video call');
      setError('Connection not available. Please try again.');
      setIsLoading(false);
      return;
    }

    // FIXED: Don't wait indefinitely for socket connection
    if (!socket.connected) {
      console.log('Socket not connected, attempting to connect...');
      setConnectionStatus('connecting');
      
      const waitForConnection = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket connection timeout'));
        }, 3000); // Reduced to 3 seconds
        
        const onConnect = () => {
          clearTimeout(timeout);
          socket.off('connect', onConnect);
          socket.off('connect_error', onError);
          resolve();
        };
        
        const onError = (error) => {
          clearTimeout(timeout);
          socket.off('connect', onConnect);
          socket.off('connect_error', onError);
          reject(error);
        };
        
        socket.on('connect', onConnect);
        socket.on('connect_error', onError);
      });
      
      try {
        await waitForConnection;
        console.log('✅ Socket connected, proceeding with initialization');
      } catch (err) {
        console.warn('⚠️ Socket connection failed, proceeding with PeerJS only mode');
        // Continue with PeerJS even if socket fails
      }
    }
    
    console.log('Starting video call initialization...');
    hasInitialized.current = true;

    try {
      // Step 1: Request media permissions first
      console.log('Step 1: Requesting media permissions...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        console.log('✅ Media permissions granted');
        myStream.current = stream;
        setHasVideoPermission(true);
        setHasAudioPermission(true);
        setIsVideoEnabled(true);
        setIsAudioEnabled(true);
        
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
          myVideo.current.play().catch(console.warn);
        }
      } catch (err) {
        console.warn('⚠️ Media permissions denied, continuing without media:', err);
        myStream.current = new MediaStream(); // Empty stream
        setHasVideoPermission(false);
        setHasAudioPermission(false);
      }

      // Step 2: Initialize PeerJS with better error handling
      console.log('Step 2: Initializing PeerJS...');
      const peerConfig = getPeerJSConfig();
      console.log('PeerJS config:', peerConfig);
      
      const peer = new Peer(null, peerConfig);
      peerInstance.current = peer;
      
      // Set a timeout for PeerJS connection
      const peerTimeout = setTimeout(() => {
        if (!myPeerId) {
          console.error('PeerJS connection timeout');
          setError('Failed to connect to video service. Please check your internet connection and try again.');
          setIsLoading(false);
        }
      }, 8000); // Increased timeout for PeerJS
    
      // Step 3: Set up peer event handlers
      peer.on('open', (id) => {
        clearTimeout(peerTimeout);
        if (!isComponentMounted.current || hasCleanedUp.current) return;
        
        console.log('✅ PeerJS connected with ID:', id);
        setMyPeerId(id);
        
        // Step 4: Join the video call room (only if socket is connected)
        if (socket && socket.connected) {
          console.log('Step 4: Joining video call room:', callId);
          socket.emit('join-video-call', callId, id);
          setConnectionStatus('waiting');
        } else {
          console.warn('Socket not connected, setting up direct peer connection');
          setConnectionStatus('waiting');
        }
        setIsLoading(false);
      });
      
      peer.on('error', (err) => {
        console.error('❌ PeerJS Error:', err);
        clearTimeout(peerTimeout);
        if (!isComponentMounted.current) return;
        
        // FIXED: Better error handling with specific messages
        if (err.type === 'peer-unavailable') {
          setError('Other user is not available. Please try again.');
        } else if (err.type === 'network') {
          setError('Network error. Please check your connection.');
        } else if (err.type === 'socket-error' || err.type === 'server-error') {
          setError('Video service unavailable. Please try again later.');
        } else {
          setError(`Connection error: ${err.message}`);
        }
        setIsLoading(false);
      });

      // Step 5: Handle incoming calls
      peer.on('call', (call) => {
        if (!isComponentMounted.current || hasCleanedUp.current) return;
        
        console.log('📞 Receiving call from:', call.peer);
        setConnectionStatus('connected');
        
        const streamToAnswer = myStream.current || new MediaStream();
        call.answer(streamToAnswer);
        currentCall.current = call;
        
        call.on('stream', (remoteStream) => {
          if (isComponentMounted.current && remoteVideo.current) {
            console.log('✅ Received remote stream');
            remoteVideo.current.srcObject = remoteStream;
            remoteVideo.current.play().catch(console.warn);
            
            const videoTrack = remoteStream.getVideoTracks()[0];
            setIsRemoteVideoEnabled(videoTrack ? videoTrack.enabled : false);
          }
        });
        
        call.on('close', () => {
          console.log('Call ended by remote peer');
          if (isComponentMounted.current) handleCallEnd();
        });
      });
      
      // Step 6: Set up socket listeners for video call events
      const handleUserJoined = (userId) => {
        if (!isComponentMounted.current || !peerInstance.current || userId === myPeerId) {
          return;
        }
        
        console.log('User joined, initiating call to:', userId);
        setConnectionStatus('calling');
        
        // Wait a bit then initiate call
        setTimeout(() => {
          if (!isComponentMounted.current || !peerInstance.current) return;
          
          const streamToSend = myStream.current || new MediaStream();
          const call = peerInstance.current.call(userId, streamToSend);
          if (!call) return;
          
          currentCall.current = call;
          
          call.on('stream', (remoteStream) => {
            if (isComponentMounted.current && remoteVideo.current) {
              console.log('✅ Received remote stream from outgoing call');
              remoteVideo.current.srcObject = remoteStream;
              remoteVideo.current.play().catch(console.warn);
              setConnectionStatus('connected');
              
              const videoTrack = remoteStream.getVideoTracks()[0];
              setIsRemoteVideoEnabled(videoTrack ? videoTrack.enabled : false);
            }
          });
          
          call.on('close', () => {
            if (isComponentMounted.current) handleCallEnd();
          });
          
        }, 1000);
      };

      const handleUserLeft = () => {
        if (isComponentMounted.current) handleCallEnd();
      };

      socket.on('user-joined-video-call', handleUserJoined);
      socket.on('user-left-video-call', handleUserLeft);
      
      // Store cleanup function
      peer.cleanupListeners = () => {
        socket.off('user-joined-video-call', handleUserJoined);
        socket.off('user-left-video-call', handleUserLeft);
      };
      
    } catch (err) {
      console.error('Error initializing video call:', err);
      if (isComponentMounted.current) {
        setError(`Failed to initialize video call: ${err.message}`);
        setIsLoading(false);
      }
    }
  }, [callId, getPeerJSConfig, myPeerId, handleCallEnd, getSocket]);

  // FIXED: Add connection retry logic
  useEffect(() => {
    console.log('VideoCall component mounted');
    isComponentMounted.current = true;
    
    // Check authentication first
    const user = getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Add retry mechanism
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptConnection = () => {
      if (!hasInitialized.current && !hasCleanedUp.current && isComponentMounted.current) {
        console.log(`Connection attempt ${retryCount + 1}/${maxRetries}`);
        initializeVideoCall().catch(err => {
          console.error('Connection attempt failed:', err);
          retryCount++;
          
          if (retryCount < maxRetries) {
            console.log(`Retrying in 2 seconds... (${retryCount}/${maxRetries})`);
            setTimeout(attemptConnection, 2000);
          } else {
            setError('Failed to connect after multiple attempts. Please check your internet connection.');
            setIsLoading(false);
          }
        });
      }
    };
    
    // Start connection attempt
    const initTimer = setTimeout(attemptConnection, 500);
    
    return () => {
      console.log('VideoCall component unmounting');
      isComponentMounted.current = false;
      clearTimeout(initTimer);
      if (!hasCleanedUp.current) {
        cleanup();
      }
    };
  }, []); // Empty dependency array - only run once

  // Control functions
  const toggleVideo = () => {
    if (!hasVideoPermission) {
      // Request permission if not already granted
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          const videoTrack = stream.getVideoTracks()[0];
          if (myStream.current) {
            myStream.current.addTrack(videoTrack);
          } else {
            myStream.current = stream;
          }
          setHasVideoPermission(true);
          setIsVideoEnabled(true);
          if (myVideo.current) {
            myVideo.current.srcObject = myStream.current;
          }
        })
        .catch(err => {
          console.error('Video permission denied:', err);
          setError('Camera access denied');
        });
      return;
    }
    
    if (myStream.current) {
      const videoTrack = myStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (!hasAudioPermission) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const audioTrack = stream.getAudioTracks()[0];
          if (myStream.current) {
            myStream.current.addTrack(audioTrack);
          } else {
            myStream.current = stream;
          }
          setHasAudioPermission(true);
          setIsAudioEnabled(true);
        })
        .catch(err => {
          console.error('Audio permission denied:', err);
          setError('Microphone access denied');
        });
      return;
    }
    
    if (myStream.current) {
      const audioTrack = myStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const endCall = () => {
    cleanup();
    navigate(-1);
  };

  // Loading state with better error information
  if (isLoading) {
    return (
      <div className="video-call-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>
            {connectionStatus === 'connecting' && 'Connecting to server...'}
            {connectionStatus === 'waiting' && 'Setting up video call...'}
            {connectionStatus === 'calling' && 'Calling...'}
            {!connectionStatus && 'Initializing video call...'}
          </p>
          {/* FIXED: Add better troubleshooting info */}
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#ccc' }}>
            <p>If this takes too long, try:</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  hasInitialized.current = false;
                  hasCleanedUp.current = false;
                  setIsLoading(true);
                  setError('');
                  initializeVideoCall();
                }}
                style={{ 
                  padding: '0.5rem 1rem', 
                  background: '#4CAF50', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Retry Connection
              </button>
              <button 
                onClick={() => window.location.reload()} 
                style={{ 
                  padding: '0.5rem 1rem', 
                  background: '#666', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Refresh Page
              </button>
              <button 
                onClick={() => navigate(-1)} 
                style={{ 
                  padding: '0.5rem 1rem', 
                  background: '#dc3545', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error && (error.includes('Failed to initialize') || error.includes('Connection not available'))) {
    return (
      <div className="video-call-container">
        <div className="error-message">
          <h3>Connection Error</h3>
          <p>{error}</p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()}>Try Again</button>
            <button onClick={() => navigate(-1)}>Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="video-call-container">
      <div className="video-call-header">
        <h2>Video Call</h2>
        <div className="connection-status">
          Status: {connectionStatus}
        </div>
        {(!hasVideoPermission || !hasAudioPermission) && (
          <div className="media-warning" style={{
            background: '#ff9800',
            color: '#000',
            padding: '0.5rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            margin: '0.5rem 0'
          }}>
            ⚠️ {!hasVideoPermission && !hasAudioPermission 
              ? 'Camera and microphone access denied' 
              : !hasVideoPermission 
              ? 'Camera access denied' 
              : 'Microphone access denied'}
          </div>
        )}
      </div>
      
      <div className="video-grid">
        {/* Local video */}
        <div className="video-container local-video">
          {hasVideoPermission && isVideoEnabled ? (
            <video 
              ref={myVideo}
              muted
              autoPlay
              playsInline
            />
          ) : (
            <div className="video-placeholder black-screen">
              <div className="placeholder-content">
                <span className="placeholder-icon">👤</span>
                <p>You {!hasVideoPermission ? '(Camera Off)' : '(Video Disabled)'}</p>
              </div>
            </div>
          )}
          <div className="video-label">You</div>
        </div>
        
        {/* Remote video */}
        <div className="video-container remote-video">
          {connectionStatus === 'connected' ? (
            isRemoteVideoEnabled ? (
              <video 
                ref={remoteVideo}
                autoPlay
                playsInline
              />
            ) : (
              <div className="video-placeholder black-screen">
                <div className="placeholder-content">
                  <span className="placeholder-icon">👤</span>
                  <p>Remote User (Camera Off)</p>
                </div>
              </div>
            )
          ) : (
            <div className="video-placeholder">
              <div className="placeholder-content">
                <span className="waiting-icon">⏳</span>
                <p>
                  {connectionStatus === 'waiting' && 'Waiting for other user...'}
                  {connectionStatus === 'calling' && 'Connecting...'}
                  {connectionStatus === 'connecting' && 'Connecting to server...'}
                  {connectionStatus === 'disconnected' && 'User disconnected'}
                </p>
              </div>
            </div>
          )}
          <div className="video-label">Remote User</div>
        </div>
      </div>
      
      <div className="video-controls">
        <button 
          onClick={toggleAudio} 
          className={`control-btn ${!isAudioEnabled ? 'disabled' : ''}`}
        >
          {hasAudioPermission 
            ? (isAudioEnabled ? '🎤 Mute' : '🔇 Unmute')
            : '🔇 Enable Audio'
          }
        </button>
        
        <button 
          onClick={toggleVideo} 
          className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
        >
          {hasVideoPermission 
            ? (isVideoEnabled ? '📷 Turn Off Video' : '📹 Turn On Video')
            : '📹 Enable Camera'
          }
        </button>
        
        <button onClick={endCall} className="control-btn end-call">
          📞 End Call
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
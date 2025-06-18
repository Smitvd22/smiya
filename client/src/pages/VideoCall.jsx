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
  const [connectionStatus, setConnectionStatus] = useState('initializing');

  // Refs
  const myVideo = useRef();
  const remoteVideo = useRef();
  const myStream = useRef();
  const peerInstance = useRef();
  const currentCall = useRef();
  const isComponentMounted = useRef(true);
  const hasInitialized = useRef(false);
  const hasCleanedUp = useRef(false);
  const socketRef = useRef(null);
  const initializationPromise = useRef(null); // Prevent multiple initializations

  // Get or initialize socket
  const getSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      return socketRef.current;
    }
    
    if (contextSocket && contextSocket.connected) {
      socketRef.current = contextSocket;
      return contextSocket;
    }
    
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

    // Clean up socket listeners and leave room
    if (peerInstance.current && peerInstance.current.cleanupListeners) {
      peerInstance.current.cleanupListeners();
    }
    
    if (peerInstance.current) {
      peerInstance.current.destroy();
      peerInstance.current = null;
    }
    
    // Leave the room
    const socket = getSocket();
    if (socket && callId) {
      socket.emit('leave-video-call', callId);
    }
  }, [callId, getSocket]);

  const getPeerJSConfig = useCallback(() => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
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
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      };
    }
    
    const host = process.env.REACT_APP_PEERJS_HOST || 'localhost';
    const port = parseInt(process.env.REACT_APP_PEERJS_PORT) || 9000;
    const path = process.env.REACT_APP_PEERJS_PATH || '/peerjs';
    const secure = process.env.REACT_APP_PEERJS_SECURE === 'true' || false;
    
    return {
      host,
      port,
      path,
      secure,
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    };
  }, []);

  // FIXED: Completely rewritten initialization logic
  const initializeVideoCall = useCallback(async () => {
    // Prevent multiple simultaneous initializations
    if (initializationPromise.current) {
      console.log('Initialization already in progress, waiting...');
      return initializationPromise.current;
    }

    if (hasInitialized.current || hasCleanedUp.current) {
      console.log('Video call already initialized or cleaned up, skipping...');
      return;
    }

    console.log('🚀 Starting video call initialization...');
    setConnectionStatus('connecting');

    initializationPromise.current = (async () => {
      try {
        hasInitialized.current = true;

        // Step 1: Get socket connection
        const socket = getSocket();
        if (!socket) {
          throw new Error('No socket available');
        }

        // Wait for socket connection if needed
        if (!socket.connected) {
          console.log('Waiting for socket connection...');
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Socket timeout')), 5000);
            
            if (socket.connected) {
              clearTimeout(timeout);
              resolve();
              return;
            }

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
        }

        console.log('✅ Socket connected');

        // Step 2: Get media permissions
        console.log('🎥 Requesting media permissions...');
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
          
          if (myVideo.current && isComponentMounted.current) {
            myVideo.current.srcObject = stream;
            myVideo.current.play().catch(console.warn);
          }
        } catch (err) {
          console.warn('⚠️ Media permissions denied, continuing without media:', err);
          myStream.current = new MediaStream();
          setHasVideoPermission(false);
          setHasAudioPermission(false);
        }

        // Step 3: Initialize PeerJS
        console.log('🔗 Initializing PeerJS...');
        setConnectionStatus('setting-up');
        
        const peerConfig = getPeerJSConfig();
        const peer = new Peer(null, peerConfig);
        peerInstance.current = peer;
        
        // Wait for PeerJS to be ready
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('PeerJS initialization timeout'));
          }, 10000);
          
          peer.on('open', (id) => {
            clearTimeout(timeout);
            console.log('✅ PeerJS connected with ID:', id);
            setMyPeerId(id);
            resolve(id);
          });
          
          peer.on('error', (err) => {
            clearTimeout(timeout);
            console.error('❌ PeerJS Error:', err);
            reject(err);
          });
        });

        // Step 4: Set up peer event handlers BEFORE joining room
        peer.on('call', (call) => {
          if (!isComponentMounted.current || hasCleanedUp.current) return;
          
          console.log('📞 Receiving call from:', call.peer);
          setConnectionStatus('connected');
          
          const streamToAnswer = myStream.current || new MediaStream();
          console.log('Answering call with stream:', streamToAnswer.getTracks().length, 'tracks');
          call.answer(streamToAnswer);
          currentCall.current = call;
          
          call.on('stream', (remoteStream) => {
            if (isComponentMounted.current && remoteVideo.current) {
              console.log('✅ Received remote stream from incoming call');
              console.log('Remote stream tracks:', {
                video: remoteStream.getVideoTracks().length,
                audio: remoteStream.getAudioTracks().length
              });
              
              remoteVideo.current.srcObject = remoteStream;
              remoteVideo.current.play().catch(console.warn);
              
              const videoTracks = remoteStream.getVideoTracks();
              setIsRemoteVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
            }
          });
          
          call.on('close', () => {
            console.log('Call ended by remote peer');
            if (isComponentMounted.current) handleCallEnd();
          });
        });

        // Step 5: Set up socket event handlers
        const handleUserJoined = (userId) => {
          if (!isComponentMounted.current || !peerInstance.current || userId === myPeerId) {
            return;
          }
          
          console.log('👤 User joined, initiating call to:', userId);
          setConnectionStatus('calling');
          
          // Small delay to ensure both peers are ready
          setTimeout(() => {
            if (!isComponentMounted.current || !peerInstance.current) return;
            
            const streamToSend = myStream.current || new MediaStream();
            console.log('📞 Initiating call with stream:', streamToSend.getTracks().length, 'tracks');
            
            const call = peerInstance.current.call(userId, streamToSend);
            if (!call) return;
            
            currentCall.current = call;
            
            call.on('stream', (remoteStream) => {
              if (isComponentMounted.current && remoteVideo.current) {
                console.log('✅ Received remote stream from outgoing call');
                console.log('Remote stream tracks:', {
                  video: remoteStream.getVideoTracks().length,
                  audio: remoteStream.getAudioTracks().length
                });
                
                remoteVideo.current.srcObject = remoteStream;
                remoteVideo.current.play().catch(console.warn);
                setConnectionStatus('connected');
                
                const videoTracks = remoteStream.getVideoTracks();
                setIsRemoteVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
              }
            });
            
            call.on('close', () => {
              if (isComponentMounted.current) handleCallEnd();
            });
            
          }, 1000); // 1 second delay
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

        // Step 6: Join the video call room
        console.log('🏠 Joining video call room:', callId);
        socket.emit('join-video-call', callId, myPeerId);
        setConnectionStatus('waiting');
        setIsLoading(false);
        
        console.log('✅ Video call initialization complete');

      } catch (err) {
        console.error('❌ Video call initialization failed:', err);
        if (isComponentMounted.current) {
          setError(`Failed to initialize video call: ${err.message}`);
          setIsLoading(false);
          setConnectionStatus('error');
        }
        throw err;
      } finally {
        initializationPromise.current = null;
      }
    })();

    return initializationPromise.current;
  }, [callId, getPeerJSConfig, myPeerId, handleCallEnd, getSocket]);

  // FIXED: Single initialization on mount
  useEffect(() => {
    console.log('VideoCall component mounted for call:', callId);
    isComponentMounted.current = true;
    
    const user = getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Start initialization immediately
    initializeVideoCall().catch(err => {
      console.error('Initial connection failed:', err);
      // Don't auto-retry here - let user click retry button
    });
    
    return () => {
      console.log('VideoCall component unmounting');
      isComponentMounted.current = false;
      if (!hasCleanedUp.current) {
        cleanup();
      }
    };
  }, [callId]); // Only depend on callId

  // Control functions
  const toggleVideo = () => {
    if (!hasVideoPermission) {
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

  const handleRetry = () => {
    console.log('🔄 Manual retry initiated');
    hasInitialized.current = false;
    hasCleanedUp.current = false;
    initializationPromise.current = null;
    setIsLoading(true);
    setError('');
    setConnectionStatus('connecting');
    initializeVideoCall();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="video-call-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>
            {connectionStatus === 'connecting' && 'Connecting to server...'}
            {connectionStatus === 'setting-up' && 'Setting up video call...'}
            {connectionStatus === 'waiting' && 'Waiting for other user...'}
            {connectionStatus === 'calling' && 'Connecting to peer...'}
            {connectionStatus === 'initializing' && 'Initializing...'}
          </p>
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#ccc' }}>
            <p>This may take a few moments. Please wait...</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={handleRetry} style={{ 
                padding: '0.5rem 1rem', 
                background: '#4CAF50', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                Retry Connection
              </button>
              <button onClick={() => window.location.reload()} style={{ 
                padding: '0.5rem 1rem', 
                background: '#666', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                Refresh Page
              </button>
              <button onClick={() => navigate(-1)} style={{ 
                padding: '0.5rem 1rem', 
                background: '#dc3545', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="video-call-container">
        <div className="error-message">
          <h3>Connection Error</h3>
          <p>{error}</p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={handleRetry}>Try Again</button>
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
                  {connectionStatus === 'setting-up' && 'Setting up call...'}
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
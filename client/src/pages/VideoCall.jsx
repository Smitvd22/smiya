import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Peer } from 'peerjs';
import { useCall } from '../contexts/CallContext';
import '../styles/VideoCall.css';

const VideoCall = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const { socket } = useCall();
  
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
  const isInitialized = useRef(false); // Add this to prevent re-initialization

  const handleCallEnd = useCallback(() => {
    setConnectionStatus('disconnected');
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
  }, []);
  
  const cleanup = useCallback(() => {
    console.log('Cleaning up video call...');
    
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
    
    if (peerInstance.current) {
      peerInstance.current.destroy();
      peerInstance.current = null;
    }
    
    // Leave the room
    if (socket && callId) {
      socket.emit('leave-video-call', callId);
    }
    
    // Reset initialization flag
    isInitialized.current = false;
  }, [socket, callId]);

  const getPeerJSConfig = useCallback(() => {
    // For production - use free cloud PeerJS service
    if (process.env.NODE_ENV === 'production') {
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
    
    // For development - local PeerJS server
    return {
      host: 'localhost', 
      port: 9000,
      path: '/peerjs',
      secure: false,
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    };
  }, []);

  const initializeVideoCall = useCallback(async () => {
    // Prevent multiple initializations
    if (isInitialized.current) {
      console.log('Video call already initialized, skipping...');
      return;
    }
    
    isInitialized.current = true;
    
    try {
      console.log('Initializing video call for room:', callId);
      
      // Initialize PeerJS with dynamic config
      const peerConfig = getPeerJSConfig();
      console.log('PeerJS Config:', peerConfig);
      
      const peer = new Peer(null, peerConfig);
      peerInstance.current = peer;
      
      peer.on('open', (id) => {
        console.log('✅ PeerJS connected successfully with ID:', id);
        if (isComponentMounted.current) {
          setMyPeerId(id);
          console.log('Joining video call room:', callId, 'with peer ID:', id);
          socket.emit('join-video-call', callId, id);
          setConnectionStatus('waiting');
          setIsLoading(false);
        }
      });
      
      peer.on('error', (err) => {
        console.error('❌ PeerJS Error:', err);
        console.error('Error type:', err.type);
        console.error('Error message:', err.message);
        
        if (isComponentMounted.current) {
          if (err.type === 'peer-unavailable') {
            setError('Connection failed. Please try again.');
          } else if (err.type === 'network') {
            setError('Network error. Please check your connection.');
          } else if (err.type === 'server-error') {
            setError('Server error. Please try again later.');
          } else {
            setError(`Connection error: ${err.message}`);
          }
          setIsLoading(false);
        }
      });
      
      // Handle incoming calls
      peer.on('call', (call) => {
        if (!isComponentMounted.current) return;
        
        console.log('Receiving call from:', call.peer);
        setConnectionStatus('connected');
        
        // Answer with current stream (might be null if no permissions yet)
        call.answer(myStream.current);
        currentCall.current = call;
        
        call.on('stream', (remoteStream) => {
          if (isComponentMounted.current && remoteVideo.current) {
            console.log('Received remote stream');
            remoteVideo.current.srcObject = remoteStream;
            
            // Check if remote video track is enabled
            const videoTrack = remoteStream.getVideoTracks()[0];
            setIsRemoteVideoEnabled(videoTrack ? videoTrack.enabled : false);
          }
        });
        
        call.on('close', () => {
          console.log('Call ended by remote peer');
          if (isComponentMounted.current) {
            handleCallEnd();
          }
        });
      });
      
      // Socket listeners for video call signaling
      const handleUserJoined = (userId) => {
        if (!isComponentMounted.current || !peerInstance.current || userId === myPeerId) return;
        
        console.log('User joined video call:', userId);
        setConnectionStatus('calling');
        
        // Initiate call to the other user
        const call = peerInstance.current.call(userId, myStream.current);
        currentCall.current = call;
        
        call.on('stream', (remoteStream) => {
          if (isComponentMounted.current && remoteVideo.current) {
            console.log('Received remote stream from outgoing call');
            remoteVideo.current.srcObject = remoteStream;
            setConnectionStatus('connected');
            
            // Check if remote video track is enabled
            const videoTrack = remoteStream.getVideoTracks()[0];
            setIsRemoteVideoEnabled(videoTrack ? videoTrack.enabled : false);
          }
        });
        
        call.on('close', () => {
          console.log('Call ended by remote peer');
          if (isComponentMounted.current) {
            handleCallEnd();
          }
        });
      };
      
      const handleUserLeft = () => {
        if (isComponentMounted.current) {
          handleCallEnd();
        }
      };
      
      socket.on('user-joined-video-call', handleUserJoined);
      socket.on('user-left-video-call', handleUserLeft);
      
      // Cleanup function to remove listeners
      const cleanupListeners = () => {
        socket.off('user-joined-video-call', handleUserJoined);
        socket.off('user-left-video-call', handleUserLeft);
      };
      
      // Store cleanup function for later use
      peer.cleanupListeners = cleanupListeners;
      
    } catch (err) {
      console.error('Error initializing video call:', err);
      if (isComponentMounted.current) {
        setError(`Failed to initialize video call: ${err.message}`);
        setIsLoading(false);
      }
    }
  }, [callId, socket, myPeerId, getPeerJSConfig, handleCallEnd]);

  // Initialize component - FIXED: Remove dependencies that cause re-initialization
  useEffect(() => {
    isComponentMounted.current = true;
    
    if (!callId) {
      setError('Invalid call ID');
      setIsLoading(false);
      return;
    }
    
    if (!socket) {
      setError('Connection not available. Please try again.');
      setIsLoading(false);
      return;
    }
    
    // Only initialize once
    if (!isInitialized.current) {
      initializeVideoCall();
    }
    
    return () => {
      console.log('VideoCall component unmounting');
      isComponentMounted.current = false;
      
      // Clean up socket listeners if peer exists
      if (peerInstance.current && peerInstance.current.cleanupListeners) {
        peerInstance.current.cleanupListeners();
      }
      
      cleanup();
    };
  }, [callId, socket]); // Remove initializeVideoCall and cleanup from dependencies

  // Request media permissions on component mount
  useEffect(() => {
    const requestInitialPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        myStream.current = stream;
        setHasVideoPermission(true);
        setHasAudioPermission(true);
        setIsVideoEnabled(true);
        setIsAudioEnabled(true);
        
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
        }
        
        console.log('✅ Media permissions granted');
      } catch (err) {
        console.warn('⚠️ Media permissions denied:', err);
        // Still allow call without media
      }
    };
    
    requestInitialPermissions();
  }, []);
  
  const requestVideoPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      
      // Add video track to existing stream or create new stream
      if (myStream.current) {
        const videoTrack = stream.getVideoTracks()[0];
        myStream.current.addTrack(videoTrack);
      } else {
        myStream.current = stream;
      }
      
      if (myVideo.current) {
        myVideo.current.srcObject = myStream.current;
      }
      
      setHasVideoPermission(true);
      setIsVideoEnabled(true);
      
      // Update peer connection if call is active
      updatePeerConnection();
      
    } catch (err) {
      console.error('Video permission denied:', err);
      setError('Video access denied. You can still join with audio only.');
    }
  };
  
  const requestAudioPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      
      // Add audio track to existing stream or create new stream
      if (myStream.current) {
        const audioTrack = stream.getAudioTracks()[0];
        myStream.current.addTrack(audioTrack);
      } else {
        myStream.current = stream;
      }
      
      if (myVideo.current) {
        myVideo.current.srcObject = myStream.current;
      }
      
      setHasAudioPermission(true);
      setIsAudioEnabled(true);
      
      // Update peer connection if call is active
      updatePeerConnection();
      
    } catch (err) {
      console.error('Audio permission denied:', err);
      setError('Audio access denied. You can still join with video only.');
    }
  };
  
  const updatePeerConnection = () => {
    if (currentCall.current && myStream.current) {
      // Replace the stream in the current call
      const sender = currentCall.current.peerConnection.getSenders();
      const tracks = myStream.current.getTracks();
      
      tracks.forEach(track => {
        const existingSender = sender.find(s => s.track && s.track.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track);
        } else {
          currentCall.current.peerConnection.addTrack(track, myStream.current);
        }
      });
    }
  };
  
  const toggleVideo = () => {
    if (!hasVideoPermission) {
      requestVideoPermission();
      return;
    }
    
    if (myStream.current) {
      const videoTrack = myStream.current.getVideoTracks()[0];
      if (videoTrack) {
        if (isVideoEnabled) {
          // Stop the video track completely to release camera access
          videoTrack.stop();
          myStream.current.removeTrack(videoTrack);
          setIsVideoEnabled(false);
          
          // Update peer connection to remove video track
          if (currentCall.current && currentCall.current.peerConnection) {
            const sender = currentCall.current.peerConnection.getSenders().find(s => 
              s.track && s.track.kind === 'video'
            );
            if (sender) {
              sender.replaceTrack(null);
            }
          }
        } else {
          // Re-enable camera when turning video back on
          restartVideoTrack();
        }
      }
    }
  };
  
  // Add new function to restart video track
  const restartVideoTrack = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = videoStream.getVideoTracks()[0];
      
      if (videoTrack && myStream.current) {
        // Add the new video track to the stream
        myStream.current.addTrack(videoTrack);
        setIsVideoEnabled(true);
        
        // Update the video element
        if (myVideo.current) {
          myVideo.current.srcObject = myStream.current;
          // Force the video to play
          myVideo.current.play().catch(console.error);
        }
        
        // Update peer connection with new video track
        if (currentCall.current && currentCall.current.peerConnection) {
          const sender = currentCall.current.peerConnection.getSenders().find(s => 
            !s.track || s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          } else {
            // Add new sender if none exists
            currentCall.current.peerConnection.addTrack(videoTrack, myStream.current);
          }
        }
      }
    } catch (err) {
      console.error('Failed to restart video track:', err);
      setError('Could not access camera. Please check permissions.');
    }
  };
  
  const toggleAudio = () => {
    if (!hasAudioPermission) {
      requestAudioPermission();
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
  
  if (isLoading) {
    return (
      <div className="video-call-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Connecting to video call...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="video-call-container">
        <div className="error-message">
          <h3>Connection Error</h3>
          <p>{error}</p>
          <button onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="video-call-container">
      <div className="video-call-header">
        <h2>Video Call</h2>
        <div className="connection-status">
          Status: {connectionStatus}
        </div>
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
          {isAudioEnabled ? '🎤' : '🔇'} {isAudioEnabled ? 'Mute' : 'Unmute'}
        </button>
        
        <button 
          onClick={toggleVideo} 
          className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
        >
          {isVideoEnabled ? '📷' : '📹'} {isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}
        </button>
        
        <button onClick={endCall} className="control-btn end-call">
          📞 End Call
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
// VideoCallCommon.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import { createPeer } from '../utils/webrtc';
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
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  
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

  // Function to synchronize track status with remote peer
  const syncTrackStatus = useCallback(() => {
    if (connectionRef.current && connectionRef.current.connected) {
      try {
        // Check actual tracks status
        const videoEnabled = stream && 
                            stream.getVideoTracks().length > 0 && 
                            stream.getVideoTracks()[0].enabled;
        
        const audioEnabled = stream && 
                            stream.getAudioTracks().length > 0 && 
                            stream.getAudioTracks()[0].enabled;
        
        // Send current track status
        connectionRef.current.send(JSON.stringify({
          type: 'track-status',
          videoEnabled: videoEnabled,
          audioEnabled: audioEnabled,
          timestamp: Date.now()
        }));
        
        console.log(`Synced track status: video=${videoEnabled}, audio=${audioEnabled}`);
      } catch (err) {
        console.warn('Error sending track status:', err);
      }
    }
  }, [stream]);

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
    let reconnectInterval = null;

    const handleConnect = () => {
      console.log("Socket connected in VideoCall");
      // Clear any pending disconnect timer and reconnect interval
      if (disconnectTimer) clearTimeout(disconnectTimer);
      if (reconnectInterval) clearInterval(reconnectInterval);
      
      setSocketConnected(true);
      
      // Join personal room for receiving calls
      const currentUser = getCurrentUser();
      if (currentUser) {
        console.log(`Joining user room: user-${currentUser.id}`);
        socket.emit('join-user-room', `user-${currentUser.id}`, (ack) => {
          console.log("Server acknowledged room join:", ack);
        });
      }
    };

    const handleDisconnect = () => {
      console.log("Socket disconnecting in VideoCall - delaying UI update");
      // Add a delay before showing disconnection to avoid flickering
      disconnectTimer = setTimeout(() => {
        if (!socket.connected) {
          console.log("Socket confirmed disconnected after delay");
          setSocketConnected(false);
          
          // Add auto-reconnect attempt if we're in an active call
          if (callState === 'active' || callState === 'calling') {
            console.log("Starting reconnection attempts");
            let attempts = 0;
            
            reconnectInterval = setInterval(() => {
              attempts++;
              if (socket.connected) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
                console.log("Socket reconnected successfully");
                setSocketConnected(true);
              } else if (attempts > 5) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
                console.log("Reconnection failed after 5 attempts");
                
                // Only end call if we've been trying to reconnect for a while
                if (callState === 'active' && endCallHandlerRef.current) {
                  setCallError('Connection lost. Call ended.');
                  setTimeout(() => {
                    if (isComponentMounted.current) {
                      endCallHandlerRef.current();
                    }
                  }, 2000);
                }
              } else {
                console.log(`Reconnection attempt ${attempts}...`);
                socket.connect();
              }
            }, 2000);
          }
        }
      }, 2000); // 2-second delay before showing disconnect
    };

    // Also add a ping mechanism to test connection health
    const pingInterval = setInterval(() => {
      if (socket.connected && (callState === 'active' || callState === 'calling')) {
        const startTime = Date.now();
        socket.volatile.emit('ping', () => {
          const latency = Date.now() - startTime;
          console.log(`Socket connection healthy, latency: ${latency}ms`);
        });
      }
    }, 15000); // Check every 15 seconds

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    if (socket.connected) handleConnect();

    return () => {
      if (disconnectTimer) clearTimeout(disconnectTimer);
      if (reconnectInterval) clearInterval(reconnectInterval);
      if (pingInterval) clearInterval(pingInterval);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, callState, setCallError, endCallHandlerRef, isComponentMounted]);

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
      
      // Ensure tracks are enabled by default
      if (audioTrack) {
        audioTrack.enabled = true;
        setIsAudioEnabled(true);
      }
      
      if (videoTrack) {
        videoTrack.enabled = true;
        setIsVideoEnabled(true);
      }
      
      console.log("Media tracks initialized:", 
        `Audio: ${audioTrack ? 'present, enabled' : 'missing'}, `,
        `Video: ${videoTrack ? 'present, enabled' : 'missing'}`);
    }
  }, [stream]);

  // Call syncTrackStatus when connection is established
  useEffect(() => {
    if (connectionStatus === 'connected') {
      // Send status after a brief delay to ensure data channel is ready
      const timer = setTimeout(() => {
        syncTrackStatus();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [connectionStatus, syncTrackStatus]);

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

  // Better listener management to avoid "listener not a function" error
  const setupConnectionListeners = useCallback((peer) => {
    if (!peer) return;
    
    const onConnect = () => {
      if (isComponentMounted.current) {
        setConnectionStatus('connected');
        console.log("Peer connection established!");
      }
    };
    
    const onError = (err) => {
      console.error("Peer connection error:", err);
      if (isComponentMounted.current) {
        setConnectionStatus('error');
        attemptReconnection(peer.id);
      }
    };
    
    const onClose = () => {
      console.log("Peer connection closed");
      if (isComponentMounted.current) {
        setConnectionStatus('disconnected');
      }
    };

    // Add named function listeners that can be properly removed later
    peer.on('connect', onConnect);
    peer.on('error', onError);
    peer.on('close', onClose);
    
    // Store listeners on the peer object for later cleanup
    peer._appListeners = {
      connect: onConnect,
      error: onError,
      close: onClose
    };
    
  }, [attemptReconnection]);

  // Cleanup resources
  const cleanupResources = useCallback(() => {
    console.log("Cleaning up resources");
    
    // First clean up video elements
    if (myVideo.current) myVideo.current.srcObject = null;
    if (userVideo.current) userVideo.current.srcObject = null;
    
    // Clean up media stream
    if (stream) {
      try {
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          try {
            track.stop();
          } catch (err) {
            console.warn("Error stopping track:", err);
          }
        });
        setStream(null);
      } catch (err) {
        console.error("Error cleaning up stream:", err);
      }
    }
    
    // Then destroy peer connection with proper error handling
    if (connectionRef.current) {
      try {
        // Remove listeners using the stored references
        if (connectionRef.current._appListeners) {
          Object.entries(connectionRef.current._appListeners).forEach(([event, listener]) => {
            if (typeof listener === 'function') {
              try {
                connectionRef.current.off(event, listener);
              } catch (err) {
                console.warn(`Error removing ${event} listener:`, err);
              }
            }
          });
        }
        
        // Properly destroy the connection by first removing data channels
        if (connectionRef.current._channel) {
          try {
            connectionRef.current._channel.close();
          } catch (err) {
            console.warn("Error closing data channel:", err);
          }
        }
        
        // Then destroy the peer object
        try {
          connectionRef.current.destroy();
        } catch (err) {
          console.error("Error destroying connection:", err);
        } finally {
          connectionRef.current = null;
        }
      } catch (err) {
        console.error("General error cleaning up connection:", err);
        connectionRef.current = null;
      }
    }
    
    // Reset states
    setStreamInitialized(false);
    setCallError('');
    setConnectionStatus('idle');
  }, [stream, setStream]);

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

  const toggleVideo = useCallback(async () => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        
        // Toggle the track
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        
        console.log(`Video track enabled: ${videoTrack.enabled}`);
        
        // Notify remote peer about track state
        if (connectionRef.current && connectionRef.current._channel && 
            connectionRef.current._channel.readyState === 'open') {
          try {
            connectionRef.current.send(JSON.stringify({
              type: 'track-status',
              videoEnabled: videoTrack.enabled,
              audioEnabled: isAudioEnabled
            }));
            console.log(`Sent track status update: video=${videoTrack.enabled}, audio=${isAudioEnabled}`);
          } catch (err) {
            console.warn('Error sending track status:', err);
          }
        } else {
          console.log('Data channel not ready, skipping track status update');
        }
      } else {
        console.log("No video tracks available to toggle");
      }
    } else {
      console.warn("Cannot toggle video - no stream available");
    }
  }, [stream, isAudioEnabled, connectionRef]);

  // Enhance the initializeStream function for better fallback behavior
  const initializeStream = useCallback(async (audioEnabled = true, videoEnabled = true) => {
    // Return existing stream if available
    if (stream) {
      console.log("Using existing stream - already initialized");
      return stream;
    }
    
    // Wait for any pending initialization
    if (streamInitPromise.current) {
      console.log("Stream initialization already in progress - waiting for result");
      return streamInitPromise.current;
    }
    
    console.log('Starting new media stream initialization');
    setStreamInitialized(false);
    setConnectionStatus('initializing');
    
    streamInitPromise.current = new Promise(async (resolve) => {
      try {
        // Check if on mobile device for optimized constraints
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        const videoConstraints = videoEnabled ? {
          width: { ideal: isMobile ? 640 : 1280 },
          height: { ideal: isMobile ? 480 : 720 },
          facingMode: 'user'
        } : false;
        
        console.log(`Requesting user media with optimized constraints: audio=${audioEnabled}, video=${JSON.stringify(videoConstraints)}`);
        
        let currentStream;
        try {
          // First try with requested constraints
          currentStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: audioEnabled ? { echoCancellation: true, noiseSuppression: true } : false
          });
        } catch (err) {
          console.error("Error getting user media:", err);
          
          // More specific error handling based on error types
          if (err.name === 'NotAllowedError') {
            setCallError('Please allow camera/microphone access to continue');
          } else if (err.name === 'NotFoundError') {
            setCallError('No camera or microphone found on your device');
          } 
            
          // If video is causing the issue, try audio only
          if ((err.name === "NotReadableError" || err.name === "NotAllowedError") && videoEnabled) {
            console.log("Attempting audio-only fallback");
            try {
              currentStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: audioEnabled
              });
              setCallError('Video unavailable - continuing with audio only');
            } catch (audioErr) {
              throw audioErr; // Re-throw if audio-only also fails
            }
          } else {
            throw err; // Re-throw if it's not a video issue or video wasn't requested
          }
        }
        
        if (!isComponentMounted.current) {
          if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
          }
          streamInitPromise.current = null;
          resolve(null);
          return;
        }
        
        // Ensure all tracks are enabled
        currentStream.getTracks().forEach(track => {
          track.enabled = true;
          console.log(`Track ${track.kind} enabled: ${track.enabled}, readyState: ${track.readyState}`);
        });
        
        console.log("Stream acquired successfully:", 
          currentStream.getTracks().map(t => `${t.kind}:${t.enabled}`).join(', '));
        
        setStream(currentStream);
        setStreamInitialized(true);
        setConnectionStatus(prev => prev === 'initializing' ? 'connecting' : prev);
        
        // Connect stream to video element
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
        
        resolve(currentStream);
      } catch (err) {
        console.error("Failed to initialize stream:", err);
        setCallError(`Media access error: ${err.message}`);
        streamInitPromise.current = null;
        resolve(null);
      }
    });
    
    return streamInitPromise.current;
  }, [stream, isComponentMounted, setStream, setStreamInitialized, setConnectionStatus, setCallError, myVideo]);

  // End call handler
  const endCallHandler = useCallback(() => {
    if (!isComponentMounted.current || callState === 'idle' || callState === 'ending') return;
    
    console.log("Ending call - setting state to ending");
    // Add an intermediate state to prevent duplicate end-call events
    setCallState('ending');
    
    // Send end-call signal first if we have a valid connection
    if (socketRef.current && socketRef.current.connected) {
      const recipientId = location.state?.recipientId;
      const callerId = location.state?.callerInfo?.id;
      const callRecipient = recipientId || callerId;
      
      if (callRecipient) {
        try {
          console.log(`Sending end-call signal to ${callRecipient}`);
          socketRef.current.emit('end-call', { to: callRecipient }, (ack) => {
            console.log("Server acknowledged end-call:", ack);
          });
        } catch (err) {
          console.error("Error emitting end-call:", err);
        }
      }
    }
    
    // Add a small delay before cleaning up resources - INCREASED for stability
    setTimeout(() => {
      if (isComponentMounted.current) {
        console.log("Moving to resource cleanup phase");
        
        // Final state change before cleanup
        setCallState('idle');
        cleanupResources();
        
        // Store the path we should return to
        const returnPath = sessionStorage.getItem('preCallPath') || -1;
        
        // Navigate back with improved handling - INCREASED timeout
        setTimeout(() => {
          if (isComponentMounted.current) {
            console.log("Navigating back after call end to:", returnPath);
            try {
              // First try navigating to stored path if available
              if (typeof returnPath === 'string' && returnPath.startsWith('/')) {
                navigate(returnPath);
              } else {
                navigate(-1);
              }
            } catch (err) {
              console.error("Navigation error:", err);
              // Final fallback
              window.location.href = '/chat';
            }
          }
        }, 500); // Increased from 300ms to 500ms
      }
    }, 500); // Increased from 300ms to 500ms
  }, [cleanupResources, navigate, callState, location.state, socketRef, isComponentMounted, setCallState]);
  
  // Store the handler in our ref after definition
  useEffect(() => {
    endCallHandlerRef.current = endCallHandler;
  }, [endCallHandler]);

  // Add this new effect to monitor connection quality
  useEffect(() => {
    if (!connectionRef.current || !connectionRef.current._pc || callState !== 'active') return;
    
    const statsInterval = setInterval(async () => {
      try {
        const stats = await connectionRef.current._pc.getStats();
        let totalPacketsLost = 0;
        let totalPackets = 0;
        let videoBitrate = 0;
        let audioBitrate = 0;
        let lastResult = null;
        
        stats.forEach(report => {
          if (report.type === 'inbound-rtp') {
            if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
              totalPacketsLost += report.packetsLost;
              totalPackets += report.packetsReceived + report.packetsLost;
            }
            
            // Calculate bitrate if we have two measurements
            if (lastResult && lastResult.has(report.id)) {
              const previous = lastResult.get(report.id);
              const bytesNow = report.bytesReceived;
              const bytesPrev = previous.bytesReceived;
              
              if (report.kind === 'video') {
                videoBitrate = 8 * (bytesNow - bytesPrev) / 1000; // kbps
              } else if (report.kind === 'audio') {
                audioBitrate = 8 * (bytesNow - bytesPrev) / 1000; // kbps
              }
            }
          }
        });
        
        // Store results for next comparison
        lastResult = stats;
        
        if (totalPackets > 0) {
          const lossRate = totalPacketsLost / totalPackets;
          console.log(`Connection stats - Loss rate: ${(lossRate * 100).toFixed(2)}%, Video: ${videoBitrate.toFixed(0)} kbps, Audio: ${audioBitrate.toFixed(0)} kbps`);
          
          // Update connection quality indicator
          if (lossRate > 0.1) {
            setConnectionQuality('poor');
          } else if (lossRate > 0.03) {
            setConnectionQuality('fair');
          } else {
            setConnectionQuality('good');
          }
        }
      } catch (err) {
        console.warn('Error getting connection stats:', err);
      }
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(statsInterval);
  }, [connectionRef, callState]);

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
    connectionQuality,
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
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Peer } from 'peerjs';
import { useCall } from '../contexts/CallContext';
import { initializeSocket, getCurrentUser } from '../services/authService';
import '../styles/VideoCall.css';

const VideoCall = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); // Added to correctly get location state
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
  const [participants, setParticipants] = useState([]);
  const [isInitiator, setIsInitiator] = useState(false);

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
  const initializationPromise = useRef(null);

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

  // Cleanup function to be more resilient
  const cleanup = useCallback(() => {
    console.log('Cleaning up video call...');

    // Set flag to prevent re-initialization right after cleanup
    hasCleanedUp.current = true;

    // Stop media tracks
    if (myStream.current) {
      myStream.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.warn('Error stopping track:', err);
        }
      });
      myStream.current = null;
    }

    // Clean up video elements
    if (myVideo.current) {
      try {
        myVideo.current.srcObject = null;
      } catch (err) {
        console.warn('Error cleaning up local video:', err);
      }
    }

    if (remoteVideo.current) {
      try {
        remoteVideo.current.srcObject = null;
      } catch (err) {
        console.warn('Error cleaning up remote video:', err);
      }
    }

    // Close peer connection
    if (currentCall.current) {
      try {
        currentCall.current.close();
      } catch (err) {
        console.warn('Error closing call:', err);
      }
      currentCall.current = null;
    }

    // Clean up PeerJS instance
    if (peerInstance.current) {
      try {
        peerInstance.current.destroy();
      } catch (err) {
        console.warn('Error destroying peer:', err);
      }
      peerInstance.current = null;
    }

    // Clean up socket listeners and leave room
    const socket = getSocket();
    if (socket && callId) {
      try {
        socket.emit('leave-video-call', callId);
      } catch (err) {
        console.warn('Error leaving video call room:', err);
      }
    }

    // Clear session storage
    if (callId) {
      sessionStorage.removeItem(`isInitiator:${callId}`);
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
            { urls: 'stun:stun1.l.google.com:19302' },  // Added "stun:" prefix
            { urls: 'stun:global.stun.twilio.com:3478' }
          ],
          // Add these for better connectivity
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
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
          { urls: 'stun:stun1.l.google.com:19302' },  // Added "stun:" prefix
          { urls: 'stun:global.stun.twilio.com:3478' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      }
    };
  }, []);

  // FIXED: Completely rewritten initialization logic
  const initializeVideoCall = useCallback(async () => {
    // Don't initialize if we've already done so or cleanup has occurred
    if (hasInitialized.current || hasCleanedUp.current) {
      console.log('Video call already initialized or cleaned up, skipping...');
      return;
    }

    // IMPORTANT: Check if we've previously initialized based on session storage
    if (sessionStorage.getItem(`videoCallInitialized:${callId}`)) {
      console.log('Found previous initialization in session storage, skipping redundant setup');
      return;
    }

    console.log('🚀 Starting video call initialization...');
    setConnectionStatus('connecting');

    initializationPromise.current = (async () => {
      try {
        // Set initialization flag
        hasInitialized.current = true;
        sessionStorage.setItem(`videoCallInitialized:${callId}`, 'true');

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

        // Debugging: Socket diagnostics
        console.log('🔍 SOCKET DIAGNOSTICS:', {
          socketExists: !!socket,
          socketConnected: socket?.connected,
          socketId: socket?.id,
          callId
        });

        // Step 2: Get media permissions with better error handling
        console.log('🎥 Requesting media permissions...');
        let mediaStream = null;

        try {
          // Explicitly release existing tracks first to prevent "Device in use" errors
          if (myStream.current) {
            myStream.current.getTracks().forEach(track => {
              track.stop();
            });
            myStream.current = null;
          }

          // Try to get both video and audio
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });

          console.log('✅ Media permissions granted');
          myStream.current = mediaStream;
          setHasVideoPermission(true);
          setHasAudioPermission(true);
          setIsVideoEnabled(true);
          setIsAudioEnabled(true);
        } catch (err) {
          console.warn('⚠️ Full media access denied, trying alternatives:', err);

          // Continue with audio-only even if "Device in use" error
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ Audio-only permission granted');
            myStream.current = mediaStream;
            setHasAudioPermission(true);
            setIsAudioEnabled(true);
            setHasVideoPermission(false);
            setIsVideoEnabled(false);
          } catch (audioErr) {
            console.warn('⚠️ No media permissions, continuing with empty stream:', audioErr);
            // Create empty stream as last resort
            myStream.current = new MediaStream();
            setHasVideoPermission(false);
            setHasAudioPermission(false);
            setIsVideoEnabled(false);
            setIsAudioEnabled(false);
          }
        }

        // Update video element
        if (myVideo.current && isComponentMounted.current && myStream.current) {
          myVideo.current.srcObject = myStream.current;
          myVideo.current.play().catch(console.warn);
        }

        // Add to VideoCall.jsx near line 295 (after getting media)
        console.log('📹 MEDIA STREAM DIAGNOSTICS:', {
          streamExists: !!myStream.current,
          videoTracks: myStream.current?.getVideoTracks().length || 0,
          audioTracks: myStream.current?.getAudioTracks().length || 0,
          videoEnabled: myStream.current?.getVideoTracks()[0]?.enabled || false,
          audioEnabled: myStream.current?.getAudioTracks()[0]?.enabled || false
        });

        // Step 3: Initialize PeerJS - LET PEERJS GENERATE A UNIQUE ID
        console.log('🔗 Initializing PeerJS...');
        setConnectionStatus('setting-up');

        const peerConfig = getPeerJSConfig();
        // Remove ID so PeerJS generates a unique one
        if (peerConfig.id) {
          delete peerConfig.id;
        }

        const peer = new Peer(undefined, peerConfig);
        peerInstance.current = peer;

        // Wait for PeerJS to be ready
        const peerId = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('PeerJS initialization timeout'));
          }, 15000); // Increase timeout

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

        // Debugging: Socket connection verification
        console.log('🔌 SOCKET CONNECTION VERIFIED:', {
          socketId: socket.id,
          rooms: Array.from(socket.rooms || []),
          transportType: socket.io?.engine?.transport?.name
        });

        // Add to VideoCall.jsx near line 320 (after PeerJS initialization)
        console.log('🔍 PEERJS DIAGNOSTICS:', {
          peerConfig: JSON.stringify(peerConfig),
          peerCreated: !!peer,
          peerConnected: peer._open,
          connectionAttempted: !!initializationPromise.current
        });

        // Step 4: Set up peer event handlers
        peer.on('call', (call) => {
          if (!isComponentMounted.current || hasCleanedUp.current) return;

          console.log('📞 Receiving call from:', call.peer);

          // Use existing stream or create empty one
          const streamToAnswer = myStream.current || new MediaStream();
          console.log('Answering call with stream:', streamToAnswer.getTracks().length, 'tracks');

          try {
            // Answer the call immediately
            call.answer(streamToAnswer);
            currentCall.current = call;

            // Set status to connecting when answering
            setConnectionStatus('connecting');

            // Handle incoming stream
            call.on('stream', (remoteStream) => {
              if (isComponentMounted.current && remoteVideo.current) {
                console.log('✅ Received remote stream from incoming call');
                console.log('Remote stream tracks:', {
                  video: remoteStream.getVideoTracks().length,
                  audio: remoteStream.getAudioTracks().length
                });

                // Update UI immediately when stream is received
                remoteVideo.current.srcObject = remoteStream;
                remoteVideo.current.play().catch(console.warn);

                // Update connection status immediately
                setConnectionStatus('connected');
                setIsLoading(false);

                // Set remote video state based on received tracks
                const videoTracks = remoteStream.getVideoTracks();
                setIsRemoteVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
              }
            });

            // Handle call ending
            call.on('close', () => {
              console.log('Call ended by remote peer');
              if (isComponentMounted.current) handleCallEnd();
            });

            // Handle call errors
            call.on('error', (err) => {
              console.error('Call error:', err);
              setConnectionStatus('error');
              setError(`Call failed: ${err.message}`);
            });
          } catch (err) {
            console.error('Error answering call:', err);
            setError(`Error answering call: ${err.message}`);
          }

          // In VideoCall.jsx, after the peer answers a call
          console.log('CONNECTION DEBUG:', {
            localPeerID: myPeerId,
            remotePeerID: call.peer,
            callID: callId,
            callObject: call,
            connectionState: peerInstance.current._pc?.connectionState
          });
        });

        // Step 5: Set up socket event handlers
        const handleUserJoined = (userId) => {
          if (!isComponentMounted.current || !peerInstance.current || userId === myPeerId) {
            console.log('Ignoring user joined event:', { userId, myPeerId });
            return;
          }

          // FIXED: Preserve initiator role by getting the value from sessionStorage again
          const storageKey = `isInitiator:${callId}`;
          const storedRole = sessionStorage.getItem(storageKey);
          const shouldInitiateCall = storedRole === 'true' || isInitiator;

          // Log the role assignment clearly with the corrected role
          console.log(`👤 User joined: ${userId} (I am ${shouldInitiateCall ? 'INITIATOR' : 'RECEIVER'}, will ${shouldInitiateCall ? 'CALL' : 'WAIT FOR CALL'})`);
          console.log(`My peer ID: ${myPeerId}, Remote peer ID: ${userId}`);

          // Only call if we're the initiator based on the corrected value
          if (shouldInitiateCall) {
            console.log('As initiator, calling peer:', userId);
            setConnectionStatus('calling');

            // Add a slightly longer delay to ensure both peers are ready
            setTimeout(() => {
              if (!isComponentMounted.current || !peerInstance.current) return;

              const streamToSend = myStream.current || new MediaStream();
              console.log('📞 Initiating call with stream:', streamToSend.getTracks().length, 'tracks');

              try {
                const call = peerInstance.current.call(userId, streamToSend);
                if (!call) {
                  console.error('Failed to create call');
                  setConnectionStatus('error');
                  return;
                }

                currentCall.current = call;

                // Add debugging for call object
                console.log('Call object created:', Object.keys(call));

                call.on('stream', (remoteStream) => {
                  console.log('✅ STREAM RECEIVED from remote peer!');
                  console.log('Stream handling - Component mounted:', isComponentMounted.current);
                  console.log('Stream handling - Remote video ref exists:', !!remoteVideo.current);
                  console.log('Stream handling - Remote stream tracks:', {
                    video: remoteStream.getVideoTracks().length,
                    audio: remoteStream.getAudioTracks().length
                  });
                  
                  if (isComponentMounted.current && remoteVideo.current) {
                    console.log('Setting remote video source and updating state to connected');
                    remoteVideo.current.srcObject = remoteStream;
                    remoteVideo.current.play().catch(err => console.warn('Error playing remote video:', err));
                    
                    setConnectionStatus('connected');
                    setIsLoading(false);
                    
                    const videoTracks = remoteStream.getVideoTracks();
                    const hasEnabledVideo = videoTracks.length > 0 && videoTracks[0].enabled;
                    console.log('Remote video enabled:', hasEnabledVideo);
                    setIsRemoteVideoEnabled(hasEnabledVideo);
                  } else {
                    console.warn('Cannot set remote video: component unmounted or ref not available');
                  }
                });

                // Add more debugging for call events
                call.on('close', () => {
                  console.log('Call ended by remote peer');
                  if (isComponentMounted.current) handleCallEnd();
                });

                call.on('error', (err) => {
                  console.error('Call error:', err);
                  // Handle serious errors only
                  if (err.type !== 'peer-unavailable') {
                    setConnectionStatus('error');
                    setError(`Call failed: ${err.message}`);
                  }
                });
              } catch (err) {
                console.error('Error initiating call:', err);
                setError(`Error initiating call: ${err.message}`);

                // Try to reconnect after a brief delay
                setTimeout(() => {
                  if (isComponentMounted.current) handleRetry();
                }, 3000);
              }
            }, 2000); // Increased delay for better reliability
          } else {
            console.log('As receiver, waiting for incoming call from:', userId);
            setConnectionStatus('waiting');
          }
        };

        const handleUserLeft = () => {
          if (isComponentMounted.current) handleCallEnd();
        };

        // Handle existing participants
        const handleExistingParticipants = (participants) => {
          console.log('Existing participants received:', participants);
          setParticipants(participants); // Store in state
          participants.forEach(participantId => {
            handleUserJoined(participantId);
          });
        };

        socket.on('user-joined-video-call', handleUserJoined);
        socket.on('user-left-video-call', handleUserLeft);
        socket.on('existing-participants', handleExistingParticipants);

        // Store cleanup function
        peer.cleanupListeners = () => {
          socket.off('user-joined-video-call', handleUserJoined);
          socket.off('user-left-video-call', handleUserLeft);
          socket.off('existing-participants', handleExistingParticipants);
        };

        // Step 6: Join the video call room with proper peer ID
        // ONLY JOIN AFTER WE HAVE THE PEER ID
        console.log('🏠 Joining video call room:', callId, 'with peer ID:', peerId);
        socket.emit('join-video-call', callId, peerId);

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
  }, [callId, getPeerJSConfig, handleCallEnd, getSocket, isInitiator]);

  // Add to VideoCall.jsx after any connectionStatus change
  useEffect(() => {
    console.log('🚦 CONNECTION STATUS CHANGED:', {
      status: connectionStatus,
      timestamp: new Date().toISOString(),
      socketConnected: getSocket()?.connected,
      peerExists: !!peerInstance.current,
      callExists: !!currentCall.current,
      myStreamTracks: myStream.current?.getTracks().length || 0
    });
  }, [connectionStatus, getSocket]);

  // Enhanced toggle video function
  const toggleVideo = () => {
    if (!hasVideoPermission) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          const videoTrack = stream.getVideoTracks()[0];
          if (myStream.current) {
            // Remove existing video tracks first
            myStream.current.getVideoTracks().forEach(track => {
              myStream.current.removeTrack(track);
              track.stop(); // Stop the old track
            });
            myStream.current.addTrack(videoTrack);
          } else {
            myStream.current = stream;
          }
          setHasVideoPermission(true);
          setIsVideoEnabled(true);

          // Update video element
          if (myVideo.current) {
            myVideo.current.srcObject = myStream.current;
            myVideo.current.play().catch(console.warn);
          }

          // Update peer connection with new stream
          if (currentCall.current && currentCall.current.peerConnection) {
            currentCall.current.peerConnection.getSenders().forEach(sender => {
              if (sender.track && sender.track.kind === 'video') {
                sender.replaceTrack(videoTrack);
              }
            });
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
        if (!videoTrack.enabled) {
          // Turning video ON
          videoTrack.enabled = true;
          setIsVideoEnabled(true);

          if (myVideo.current) {
            myVideo.current.srcObject = myStream.current;
            myVideo.current.play().catch(console.warn);
          }
        } else {
          // Turning video OFF - STOP the track completely
          videoTrack.enabled = false;
          videoTrack.stop(); // Actually stop the camera
          myStream.current.removeTrack(videoTrack); // Remove from stream
          setIsVideoEnabled(false);

          // Clear video element
          if (myVideo.current) {
            myVideo.current.srcObject = null;
            myVideo.current.src = '';
          }

          // Update peer connection
          if (currentCall.current && currentCall.current.peerConnection) {
            currentCall.current.peerConnection.getSenders().forEach(sender => {
              if (sender.track && sender.track.kind === 'video') {
                sender.replaceTrack(null); // Remove video track from peer
              }
            });
          }
        }
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

  // Move the handleRetry function up, before the useEffect that uses it
  const handleRetry = useCallback(() => {
    console.log('🔄 Manual retry initiated');

    // Force cleanup first with better media resource management
    cleanup();

    // Wait longer before retry to ensure resources are fully released
    setTimeout(() => {
      // Reset initialization state
      hasInitialized.current = false;
      hasCleanedUp.current = false;
      initializationPromise.current = null;

      // Reset state
      setIsLoading(true);
      setError('');
      setConnectionStatus('connecting');

      // Preserve permissions state to avoid unnecessary permission requests
      // but reset active state
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      setIsRemoteVideoEnabled(false);

      // Delay the new initialization to allow resources to be fully released
      setTimeout(() => {
        initializeVideoCall();
      }, 2000);
    }, 1000);
  }, [cleanup, initializeVideoCall]);

  // Increase timeout for connection establishment
  useEffect(() => {
    let connectionTimeout;

    if (connectionStatus === 'calling' || connectionStatus === 'connecting') {
      connectionTimeout = setTimeout(() => {
        if (connectionStatus !== 'connected' && isComponentMounted.current) {
          console.warn('Connection timeout, retrying...');
          setError('Connection timeout. Retrying...');

          // Attempt retry
          handleRetry();
        }
      }, 30000); // Increase from 15 to 30 seconds
    }

    return () => {
      if (connectionTimeout) clearTimeout(connectionTimeout);
    };
  }, [connectionStatus, handleRetry]);

  // Enhanced beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('Page unloading, cleaning up media...');
      if (myStream.current) {
        myStream.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // REMOVED: Don't call handleBeforeUnload() here
      // This was causing premature cleanup during React StrictMode's test unmount
    };
  }, []);

  // Use location state to get isInitiator - KEY FIX
  useEffect(() => {
    if (!callId) return;

    const storageKey = `isInitiator:${callId}`;

    // 1. Check if location.state explicitly sets isInitiator
    if (location.state && typeof location.state.isInitiator === 'boolean') {
      setIsInitiator(location.state.isInitiator);
      // Store in sessionStorage with a more reliable key format
      sessionStorage.setItem(storageKey, location.state.isInitiator ? 'true' : 'false');
      console.log(`▶️ Role from Chat: ${location.state.isInitiator ? 'INITIATOR' : 'RECEIVER'}`);
    } else {
      // 2. If no location.state, check sessionStorage to see if we stored a role
      const storedRole = sessionStorage.getItem(storageKey);
      if (storedRole !== null) {
        const boolVal = (storedRole === 'true');
        setIsInitiator(boolVal);
        console.log(`▶️ Restored role from sessionStorage: ${boolVal ? 'INITIATOR' : 'RECEIVER'}`);
      } else {
        // 3. Otherwise default to receiver
        setIsInitiator(false);
        console.log('▶️ Default role: RECEIVER (no override from Chat, none in storage)');
      }
    }
  }, [callId, location.state]);

  // FIXED: Single initialization on mount
  useEffect(() => {
    console.log('VideoCall component mounted for call:', callId);
    isComponentMounted.current = true;

    const user = getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    // IMPORTANT: Save initialization state to prevent repeated attempts
    if (!sessionStorage.getItem(`videoCallMounted:${callId}`)) {
      sessionStorage.setItem(`videoCallMounted:${callId}`, 'true');

      // Start initialization immediately
      initializeVideoCall().catch(err => {
        console.error('Initial connection failed:', err);
      });
    } else {
      console.log('Component was remounted, continuing with existing setup');
    }

    return () => {
      console.log('VideoCall component unmounting');
      isComponentMounted.current = false;

      // Only perform full cleanup when the component is truly being removed
      if (process.env.NODE_ENV !== 'development') {
        if (!hasCleanedUp.current) {
          cleanup();
        }
      } else {
        // In development, just log that we're skipping cleanup during unmount
        console.log('Skipping full cleanup on unmount in development mode');
      }
    };
  }, [callId, cleanup, initializeVideoCall, navigate]);

  // Update video element handling
  useEffect(() => {
    if (myVideo.current && myStream.current && hasVideoPermission && isVideoEnabled) {
      myVideo.current.srcObject = myStream.current;
      myVideo.current.play().catch(err => {
        console.warn('Error playing local video:', err);
      });
    } else if (myVideo.current && (!hasVideoPermission || !isVideoEnabled)) {
      myVideo.current.srcObject = null;
    }
  }, [hasVideoPermission, isVideoEnabled]);

  // Add this effect to help debug track changes
  useEffect(() => {
    if (remoteVideo.current && remoteVideo.current.srcObject) {
      const stream = remoteVideo.current.srcObject;
      
      const trackHandler = (event) => {
        console.log('Remote track state changed:', event.type);
        const videoTracks = stream.getVideoTracks();
        const hasEnabledVideo = videoTracks.length > 0 && videoTracks[0].enabled;
        console.log('Remote video enabled after change:', hasEnabledVideo);
        setIsRemoteVideoEnabled(hasEnabledVideo);
      };
      
      stream.addEventListener('addtrack', trackHandler);
      stream.addEventListener('removetrack', trackHandler);
      
      return () => {
        stream.removeEventListener('addtrack', trackHandler);
        stream.removeEventListener('removetrack', trackHandler);
      };
    }
  }, [connectionStatus]);

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
          {hasVideoPermission && isVideoEnabled && myStream.current ? (
            <video
              ref={myVideo}
              muted
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="video-placeholder black-screen">
              <div className="placeholder-content">
                <span className="placeholder-icon">👤</span>
                <p>
                  {!hasVideoPermission
                    ? 'Camera Access Denied'
                    : !isVideoEnabled
                      ? 'Camera Off'
                      : 'Loading Camera...'
                  }
                </p>
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
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
          <div className="video-label">
            {connectionStatus === 'connected' && !isRemoteVideoEnabled ? 'Remote User (Camera Off)' : 'Remote User'}
          </div>
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

      {/* Debug info - shows myPeerId in development mode */}
      <div className="debug-info">
        {process.env.NODE_ENV === 'development' && (
          <div className="peer-id">My Peer ID: {myPeerId}</div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
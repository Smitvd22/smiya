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
  const remoteStreamRef = useRef(null); // NEW: Ref to store remote stream

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
  const cleanup = useCallback((fullCleanup = false) => {
    console.log('Cleaning up video call...', fullCleanup ? '(full cleanup)' : '(partial cleanup)');

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
    
    // Only clear ALL session storage during full cleanup (when intentionally ending call)
    if (fullCleanup && callId) {
      sessionStorage.removeItem(`isInitiator:${callId}`);
      sessionStorage.removeItem(`videoCallInitialized:${callId}`);
      sessionStorage.removeItem(`videoCallMounted:${callId}`);
      
      // Clear all processing flags for this call
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith(`processed_user_${callId}_`)) {
          sessionStorage.removeItem(key);
        }
      });
    } else {
      // For partial cleanup (during remounts), only clear initialization flags
      // but PRESERVE the role information
      if (callId) {
        sessionStorage.removeItem(`videoCallInitialized:${callId}`);
        // Don't remove isInitiator value
      }
    }
  }, [callId, getSocket]);

  // Enhance ICE servers for better production connectivity
  const getPeerJSConfig = useCallback(() => {
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
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            // Add free TURN servers if available
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ],
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        }
      };
    }
    
    // Rest of your development config...
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

  // 1. First, declare initializeVideoCall using useRef to break the circular dependency
  const initializeVideoCallRef = useRef(null);

  // 2. Then define handleRetry using the ref
  const handleRetry = useCallback(() => {
    console.log('🔄 Manual retry initiated');
    
    // Set a flag to prevent cleanup from navigation
    window.isIntentionalNavigation = false;

    // Force cleanup first
    cleanup(false);

    // Wait longer to ensure resources are released
    setTimeout(() => {
      // Reset initialization state
      hasInitialized.current = false;
      hasCleanedUp.current = false;
      initializationPromise.current = null;
      
      // Clear initialization flag in session storage
      sessionStorage.removeItem(`videoCallInitialized:${callId}`);

      // Reset state
      setIsLoading(true);
      setError('');
      setConnectionStatus('connecting');

      // Preserve permissions state but reset active state
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      setIsRemoteVideoEnabled(false);

      // Delay new initialization to allow resources to be fully released
      setTimeout(() => {
        initializeVideoCallRef.current();
      }, 2000);
    }, 1000);
  }, [cleanup, callId]);

  // 3. Then define the actual function and assign it to the ref
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
            
            // CRITICAL FIX: Store peer ID in session storage to survive remounts
            sessionStorage.setItem(`peerId:${callId}`, id);
            
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
              console.log('✅ Received remote stream from incoming call');
              console.log('Remote stream tracks:', {
                video: remoteStream.getVideoTracks().length,
                audio: remoteStream.getAudioTracks().length
              });
              
              if (isComponentMounted.current) {
                // CRITICAL FIX: Update connection status immediately
                setConnectionStatus('connected');
                setIsLoading(false);
                
                // Store remote stream in a ref for later use
                remoteStreamRef.current = remoteStream;
                
                // Set remote video state based on received tracks
                const videoTracks = remoteStream.getVideoTracks();
                setIsRemoteVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
                
                // Only try to set video element if ref exists
                if (remoteVideo.current) {
                  remoteVideo.current.srcObject = remoteStream;
                  remoteVideo.current.play().catch(err => console.warn('Error playing remote video:', err));
                } else {
                  console.log('Remote video ref not ready yet, will be set in useEffect');
                }
              } else {
                console.warn('Component not mounted, cannot handle stream');
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

          // Add this around line 480 in the call object creation section
          if (call && call.peerConnection) {
            call.peerConnection.addEventListener('connectionstatechange', () => {
              console.log(`WebRTC connection state: ${call.peerConnection.connectionState}`);
              if (call.peerConnection.connectionState === 'connected') {
                // Ensure we update the status when WebRTC reports connected
                setConnectionStatus('connected');
              }
            });
            
            call.peerConnection.addEventListener('iceconnectionstatechange', () => {
              console.log(`ICE connection state: ${call.peerConnection.iceConnectionState}`);
            });
          }
        });        // Step 5: Set up socket event handlers
        const handleUserJoined = (userId) => {
          if (!isComponentMounted.current || !peerInstance.current || userId === myPeerId) {
            console.log('Ignoring user joined event:', { userId, myPeerId });
            return;
          }

          // CRITICAL FIX: Always use sessionStorage as the source of truth for role
          const storageKey = `isInitiator:${callId}`;
          const storedRole = sessionStorage.getItem(storageKey);
          
          // Prevent duplicate processing of the same user during remounts
          const processedKey = `processed_user_${callId}_${userId}`;
          if (sessionStorage.getItem(processedKey)) {
            console.log(`User ${userId} already processed for call ${callId}, skipping...`);
            return;
          }
          
          // Only use storedRole if it exists, don't fall back to isInitiator state
          // because state might be reset during remounts
          const shouldInitiateCall = storedRole === 'true';

          // Mark this user as processed to prevent duplicate calls during remounts
          sessionStorage.setItem(processedKey, 'true');

          // Log the role assignment clearly with the corrected role
          console.log(`👤 User joined: ${userId} (I am ${shouldInitiateCall ? 'INITIATOR' : 'RECEIVER'}, will ${shouldInitiateCall ? 'CALL' : 'WAIT FOR CALL'})`);
          console.log(`My peer ID: ${myPeerId}, Remote peer ID: ${userId}`);
          console.log(`Role determination: storedRole="${storedRole}", isInitiator=${isInitiator}, shouldInitiateCall=${shouldInitiateCall}`);

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
                  
                  // Store the stream so we can use it later even if the ref isn't ready yet
                  if (isComponentMounted.current) {
                    // CRITICAL FIX: Update connection status regardless of ref
                    setConnectionStatus('connected');
                    setIsLoading(false);
                    
                    // Store remote stream in a ref for later use
                    if (!remoteStreamRef.current) {
                      remoteStreamRef.current = remoteStream;
                    }
                    
                    // Set remote video enabled state based on tracks
                    const videoTracks = remoteStream.getVideoTracks();
                    setIsRemoteVideoEnabled(videoTracks.length > 0 && videoTracks[0].enabled);
                    
                    // If ref is available, set it directly
                    if (remoteVideo.current) {
                      remoteVideo.current.srcObject = remoteStream;
                      remoteVideo.current.play().catch(err => console.warn('Error playing remote video:', err));
                    } else {
                      console.log('Remote video ref not ready, will update in useEffect');
                    }
                  } else {
                    console.warn('Component not mounted, cannot handle stream');
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
  }, [callId, getPeerJSConfig, handleCallEnd, getSocket, isInitiator, myPeerId, setParticipants, handleRetry]);

  // 4. Set the ref to point to the actual function
  useEffect(() => {
    initializeVideoCallRef.current = initializeVideoCall;
  }, [initializeVideoCall]);

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
      // This part is fine - handles initial permission request
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

    // Modified part to handle turning video back on
    if (myStream.current) {
      const videoTracks = myStream.current.getVideoTracks();
      
      // If no video tracks or they're disabled
      if (videoTracks.length === 0 || !videoTracks[0].enabled) {
        // Request a new video track
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            const newVideoTrack = stream.getVideoTracks()[0];
            
            // Add the new track to our existing stream
            myStream.current.addTrack(newVideoTrack);
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
                  sender.replaceTrack(newVideoTrack);
                } else if (!sender.track && sender.kind === 'video') {
                  // If no track but sender is for video
                  sender.replaceTrack(newVideoTrack);
                }
              });
              
              // If no video sender exists, add one
              const hasVideoSender = currentCall.current.peerConnection.getSenders()
                .some(sender => sender.track?.kind === 'video');
                
              if (!hasVideoSender) {
                currentCall.current.peerConnection.addTrack(newVideoTrack, myStream.current);
              }
            }
          })
          .catch(err => {
            console.error('Failed to get video stream:', err);
            setError('Could not enable camera');
          });
      } else {
        // Turn OFF logic - improved signaling to remote peer
        const videoTrack = videoTracks[0];
        videoTrack.enabled = false; // First disable the track
        
        // Signal to remote peer that video is off BEFORE stopping the track
        if (currentCall.current && currentCall.current.peerConnection) {
          // Find video sender and disable it
          const videoSenders = currentCall.current.peerConnection.getSenders()
            .filter(sender => sender.track && sender.track.kind === 'video');
            
          if (videoSenders.length > 0) {
            // Option 1: Mute the track but keep it (better for resuming)
            videoSenders.forEach(sender => {
              if (sender.track) {
                sender.track.enabled = false;
              }
            });
            
            // Option 2: Or replace with null track
            // videoSenders.forEach(sender => sender.replaceTrack(null));
          }
        }
        
        // After signaling, stop the track
        videoTrack.stop();
        myStream.current.removeTrack(videoTrack);
        setIsVideoEnabled(false);
        
        // Clear video element
        if (myVideo.current) {
          myVideo.current.srcObject = myStream.current;
        }
      }
    }
  };

  // // Add this function (around line 650 in the toggleVideo area)
  // const updateRemoteTrackState = () => {
  //   if (currentCall.current && currentCall.current.peerConnection) {
  //     const senders = currentCall.current.peerConnection.getSenders();
  //     const videoSender = senders.find(sender => sender.track?.kind === 'video');
      
  //     if (videoSender && videoSender.track) {
  //       // Notify the other side about track state changes
  //       console.log(`Notifying peer that video is now ${videoSender.track.enabled ? 'enabled' : 'disabled'}`);
        
  //       // Send a data channel message if possible
  //       if (currentCall.current.dataChannel && 
  //           currentCall.current.dataChannel.readyState === 'open') {
  //         currentCall.current.dataChannel.send(JSON.stringify({
  //           type: 'video-state',
  //           enabled: videoSender.track.enabled
  //         }));
  //       }
  //     }
  //   }
  // };

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
    cleanup(true); // Pass true for full cleanup
    navigate(-1);
  };

  // Increase timeout and add progressive retry
  useEffect(() => {
    let connectionTimeout;

    if (connectionStatus === 'calling' || connectionStatus === 'connecting') {
      // Progressive timeouts with multiple retries
      const attemptRetry = (attempt = 1) => {
        const timeout = 15000 + (attempt * 5000); // Increase timeout with each attempt
        
        console.log(`Setting connection timeout #${attempt} for ${timeout}ms`);
        connectionTimeout = setTimeout(() => {
          if (connectionStatus !== 'connected' && isComponentMounted.current) {
            console.warn(`Connection timeout #${attempt}, retrying...`);
            
            if (attempt < 3) {
              // Just retry the peer connection without full cleanup
              if (peerInstance.current) {
                // Reconnect just the peer
                console.log('Attempting to reconnect peer without full cleanup');
                
                // Notify the user
                setError(`Connection attempt #${attempt} timed out. Retrying...`);
                
                // Start next attempt
                attemptRetry(attempt + 1);
              } else {
                // If no peer instance, do a full retry
                handleRetry();
              }
            } else {
              // After 3 attempts, do a full retry
              setError('Connection timed out after multiple attempts. Trying one last time...');
              handleRetry();
            }
          }
        }, timeout);
      };
      
      // Start first attempt
      attemptRetry();
    }

    return () => {
      if (connectionTimeout) clearTimeout(connectionTimeout);
    };
  }, [connectionStatus, handleRetry]);

  // Enhanced beforeunload handler
  useEffect(() => {
    // Flag to track intentional navigation
    window.isIntentionalNavigation = false;
    
    const handleBeforeUnload = (e) => {
      console.log('Page unloading, cleaning up media...');
      // Set intentional navigation flag
      window.isIntentionalNavigation = true;
      
      if (myStream.current) {
        myStream.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
      
      // For some browsers, we need to return a message
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
      console.log(`▶️ Stored in sessionStorage: ${storageKey}=${location.state.isInitiator ? 'true' : 'false'}`);
    } else {
      // 2. If no location.state, check sessionStorage to see if we stored a role
      const storedRole = sessionStorage.getItem(storageKey);
      if (storedRole !== null) {
        const boolVal = (storedRole === 'true');
        setIsInitiator(boolVal);
        console.log(`▶️ Restored role from sessionStorage: ${boolVal ? 'INITIATOR' : 'RECEIVER'} (stored value: "${storedRole}")`);
      } else {
        // 3. Otherwise default to receiver
        setIsInitiator(false);
        sessionStorage.setItem(storageKey, 'false');
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

    // CRITICAL FIX: Prevent multiple initializations with better mounting check
    const mountKey = `videoCallMounted:${callId}`;
    const initKey = `videoCallInitialized:${callId}`;
    
    // Only initialize if not already done
    if (!sessionStorage.getItem(mountKey) || !sessionStorage.getItem(initKey)) {
      sessionStorage.setItem(mountKey, 'true');
      
      // Start initialization immediately, but don't reinitialize if already done
      if (!sessionStorage.getItem(initKey)) {
        initializeVideoCall().catch(err => {
          console.error('Initial connection failed:', err);
          setError(`Connection failed: ${err.message}`);
        });
      }
    } else {
      console.log('Component was remounted, continuing with existing setup');
      
      // CRITICAL FIX: Restore myPeerId from session storage on remount
      const peerIdKey = `peerId:${callId}`;
      const storedPeerId = sessionStorage.getItem(peerIdKey);
      if (storedPeerId && !myPeerId) {
        console.log('Restoring peer ID from session storage:', storedPeerId);
        setMyPeerId(storedPeerId);
      }
      
      // Restore remote stream if available
      if (connectionStatus === 'connected' && remoteStreamRef.current && remoteVideo.current) {
        console.log('Restoring video stream on remount');
        remoteVideo.current.srcObject = remoteStreamRef.current;
        remoteVideo.current.play().catch(console.warn);
      }
    }

    return () => {
      console.log('VideoCall component unmounting');
      isComponentMounted.current = false;
      
      // Only perform cleanup when intentionally navigating away
      if (window.isIntentionalNavigation) {
        cleanup(true);
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

  // Update the track change effect (around line 865)
  useEffect(() => {
    if (remoteVideo.current && remoteVideo.current.srcObject) {
      const stream = remoteVideo.current.srcObject;
      
      const trackHandler = (event) => {
        console.log('Remote track state changed:', event.type);
        updateRemoteVideoState(stream);
      };
      
      const trackEnabledHandler = () => {
        console.log('Track enabled/disabled event');
        updateRemoteVideoState(stream);
      };
      
      // Helper function to update remote video state
      const updateRemoteVideoState = (s) => {
        const videoTracks = s.getVideoTracks();
        const hasEnabledVideo = videoTracks.length > 0 && videoTracks[0].enabled;
        console.log('Remote video enabled after change:', hasEnabledVideo);
        setIsRemoteVideoEnabled(hasEnabledVideo);
      };
      
      // Listen for track changes
      stream.addEventListener('addtrack', trackHandler);
      stream.addEventListener('removetrack', trackHandler);
      
      // Also monitor each track's enabled state
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', trackEnabledHandler);
        track.addEventListener('mute', trackEnabledHandler);
        track.addEventListener('unmute', trackEnabledHandler);
      });
      
      return () => {
        stream.removeEventListener('addtrack', trackHandler);
        stream.removeEventListener('removetrack', trackHandler);
        
        stream.getTracks().forEach(track => {
          track.removeEventListener('ended', trackEnabledHandler);
          track.removeEventListener('mute', trackEnabledHandler);
          track.removeEventListener('unmute', trackEnabledHandler);
        });
      };
    }
  }, [connectionStatus, remoteVideo.current?.srcObject]);

  // Enhanced remote track state detection
  useEffect(() => {
    if (!remoteVideo.current || !remoteVideo.current.srcObject) return;
    
    const checkRemoteVideoState = () => {
      const stream = remoteVideo.current.srcObject;
      const videoTracks = stream.getVideoTracks();
      
      // Check if we have active video tracks
      const hasActiveVideo = videoTracks.length > 0 && 
        videoTracks.some(track => track.enabled && track.readyState === 'live');
      
      console.log('Remote video state check:', {
        hasActiveVideo,
        tracksCount: videoTracks.length,
        tracksEnabled: videoTracks.map(t => t.enabled),
        tracksState: videoTracks.map(t => t.readyState)
      });
      
      // Update state based on active video
      setIsRemoteVideoEnabled(hasActiveVideo);
    };
    
    // Check immediately
    checkRemoteVideoState();
    
    // Set up interval to periodically check
    const checkInterval = setInterval(checkRemoteVideoState, 2000);
    
    // Set up event listeners
    const stream = remoteVideo.current.srcObject;
    const handleTrackEvent = () => checkRemoteVideoState();
    
    stream.addEventListener('addtrack', handleTrackEvent);
    stream.addEventListener('removetrack', handleTrackEvent);
    
    return () => {
      clearInterval(checkInterval);
      if (stream) {
        stream.removeEventListener('addtrack', handleTrackEvent);
        stream.removeEventListener('removetrack', handleTrackEvent);
      }
    };
  }, [remoteVideo.current?.srcObject]);

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
            <>
              <video
                ref={remoteVideo}
                autoPlay
                playsInline
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  display: isRemoteVideoEnabled ? 'block' : 'none' 
                }}
                onEmptied={() => setIsRemoteVideoEnabled(false)}
              />
              {!isRemoteVideoEnabled && (
                <div className="video-placeholder black-screen">
                  <div className="placeholder-content">
                    <span className="placeholder-icon">👤</span>
                    <p>Remote User (Camera Off)</p>
                  </div>
                </div>
              )}
            </>
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
            {connectionStatus === 'connected' 
              ? (isRemoteVideoEnabled ? 'Remote User' : 'Remote User (Camera Off)')
              : 'Remote User'}
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

      {/* Participants list - NEW SECTION */}
      <div className="participants-list">
        <h3>Participants ({participants.length})</h3>
        <ul>
          {participants.map((participantId, index) => (
            <li key={index}>{participantId === myPeerId ? 'You' : participantId}</li>
          ))}
        </ul>
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
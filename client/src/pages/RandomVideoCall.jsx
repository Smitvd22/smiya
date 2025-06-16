import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Peer } from 'peerjs';
import { useCall } from '../contexts/CallContext';
import '../styles/VideoCall.css';

const RandomVideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useCall();
  
  const [myPeerId, setMyPeerId] = useState('');
  const [peers, setPeers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [hasMediaPermission, setHasMediaPermission] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const myVideo = useRef();
  const myStream = useRef();
  const peerInstance = useRef();
  const peersRef = useRef({});
  const isComponentMounted = useRef(true);
  const roomJoined = useRef(false);
  const currentMyPeerIdRef = useRef(''); // Add ref to track myPeerId for cleanup
  
  // Get state from navigation
  useEffect(() => {
    if (location.state?.isHost) {
      setIsHost(true);
    }
  }, [location.state]);

  // Component mount tracking
  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
    };
  }, []);

  // Update the ref whenever myPeerId changes
  useEffect(() => {
    currentMyPeerIdRef.current = myPeerId;
  }, [myPeerId]);

  // Add a peer video
  const addPeerVideo = (peerId, stream) => {
    if (!isComponentMounted.current) return;
    
    setPeers(prevPeers => ({
      ...prevPeers,
      [peerId]: stream
    }));
    setParticipantCount(prev => prev + 1);
  };
  
  // Remove a peer's video
  const removeVideo = (peerId) => {
    if (!isComponentMounted.current) return;
    
    setPeers(prevPeers => {
      const updatedPeers = { ...prevPeers };
      delete updatedPeers[peerId];
      return updatedPeers;
    });
    delete peersRef.current[peerId];
    setParticipantCount(prev => Math.max(0, prev - 1));
  };
  
  // Main initialization effect - FIXED to prevent multiple initializations
  useEffect(() => {
    if (!roomId || !socket || isInitialized) {
      return;
    }

    // Prevent multiple initializations
    setIsInitialized(true);
    
    console.log(`Initializing random video call for room: ${roomId}`);
    
    // FIXED: Copy refs to variables inside the effect
    const currentPeersRef = peersRef.current;
    const currentSocket = socket;
    
    const initializeRoom = async () => {
      try {
        setIsLoading(true);
        
        // Try to get user media, but continue without it if permission denied
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          setHasMediaPermission(true);
          myStream.current = stream;
          
          if (myVideo.current && isComponentMounted.current) {
            myVideo.current.srcObject = stream;
          }
        } catch (err) {
          console.warn('Media access denied, continuing without media:', err);
          setHasMediaPermission(false);
          // Create empty stream for users without media permission
          stream = new MediaStream();
          myStream.current = stream;
        }
        
        if (!isComponentMounted.current) {
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          return;
        }
        
        // Initialize peer connection with stable configuration
        const peer = new Peer(undefined, {
          host: process.env.NODE_ENV === 'production' ? window.location.hostname : 'localhost',
          port: process.env.NODE_ENV === 'production' ? 443 : 9000,
          path: '/peerjs',
          secure: process.env.NODE_ENV === 'production',
          debug: 2,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });
        
        peerInstance.current = peer;
        
        // Set up peer event listeners
        peer.on('open', (id) => {
          if (!isComponentMounted.current) return;
          
          console.log('My peer ID:', id);
          setMyPeerId(id);
          setParticipantCount(1);
          
          // Only join room once
          if (currentSocket && !roomJoined.current) {
            roomJoined.current = true;
            console.log(`Joining random video call room: ${roomId} with peer ID: ${id}`);
            currentSocket.emit('join-random-videocall', roomId, id);
          }
        });
        
        peer.on('call', (call) => {
          if (!isComponentMounted.current) return;
          
          console.log('Receiving call from:', call.peer);
          call.answer(stream);
          const peerId = call.peer;
          
          call.on('stream', (userVideoStream) => {
            if (isComponentMounted.current && !currentPeersRef[peerId]) {
              console.log('Received stream from peer:', peerId);
              addPeerVideo(peerId, userVideoStream);
            }
          });
          
          call.on('close', () => {
            if (isComponentMounted.current) {
              console.log('Call closed with peer:', peerId);
              removeVideo(peerId);
            }
          });
          
          call.on('error', (err) => {
            console.error('Call error with peer:', peerId, err);
            if (isComponentMounted.current) {
              removeVideo(peerId);
            }
          });
          
          currentPeersRef[peerId] = call;
        });
        
        peer.on('error', (err) => {
          console.error('Peer error:', err);
          if (isComponentMounted.current) {
            setError(`Connection error: ${err.type}`);
          }
        });
        
        peer.on('disconnected', () => {
          console.log('Peer disconnected, attempting to reconnect...');
          if (isComponentMounted.current && !peer.destroyed) {
            peer.reconnect();
          }
        });
        
        // Set up socket event listeners
        const handleUserJoined = (userId) => {
          if (!isComponentMounted.current || !peerInstance.current || currentPeersRef[userId]) {
            return;
          }
          
          console.log('User joined, calling:', userId);
          const call = peerInstance.current.call(userId, stream);
          
          call.on('stream', (userVideoStream) => {
            if (isComponentMounted.current) {
              console.log('Received stream from new user:', userId);
              addPeerVideo(userId, userVideoStream);
            }
          });
          
          call.on('close', () => {
            if (isComponentMounted.current) {
              console.log('Call closed with new user:', userId);
              removeVideo(userId);
            }
          });
          
          call.on('error', (err) => {
            console.error('Call error with new user:', userId, err);
            if (isComponentMounted.current) {
              removeVideo(userId);
            }
          });
          
          currentPeersRef[userId] = call;
        };
        
        const handleUserLeft = (userId) => {
          if (!isComponentMounted.current) return;
          
          console.log('User left:', userId);
          if (currentPeersRef[userId]) {
            currentPeersRef[userId].close();
            removeVideo(userId);
          }
        };
        
        // Add socket listeners
        currentSocket.on('user-joined-random-videocall', handleUserJoined);
        currentSocket.on('user-left-random-videocall', handleUserLeft);
        
        // Store cleanup functions
        peer._cleanup = () => {
          currentSocket.off('user-joined-random-videocall', handleUserJoined);
          currentSocket.off('user-left-random-videocall', handleUserLeft);
        };
        
        setIsLoading(false);
        
      } catch (err) {
        console.error('Error setting up video room:', err);
        if (isComponentMounted.current) {
          setError(err.message || 'Could not set up video call');
          setIsLoading(false);
        }
      }
    };
    
    initializeRoom();
    
    // Cleanup function - FIXED to prevent reconnection loops and ESLint warnings
    return () => {
      console.log('Cleaning up RandomVideoCall component');
      
      // FIXED: Use the copied references from the beginning of the effect
      // Close all peer connections using the copied reference
      Object.values(currentPeersRef).forEach(call => {
        if (call && call.close) {
          try {
            call.close();
          } catch (err) {
            console.warn('Error closing peer call:', err);
          }
        }
      });
      
      // Stop media stream
      if (myStream.current) {
        try {
          myStream.current.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.warn('Error stopping media tracks:', err);
        }
      }
      
      // Clean up peer
      if (peerInstance.current) {
        try {
          // Remove socket listeners first
          if (peerInstance.current._cleanup) {
            peerInstance.current._cleanup();
          }
          
          // Destroy peer connection
          if (!peerInstance.current.destroyed) {
            peerInstance.current.destroy();
          }
        } catch (err) {
          console.warn('Error destroying peer:', err);
        }
      }
      
      // Leave socket room - only if we actually joined
      // FIXED: Use currentMyPeerIdRef.current instead of myPeerId from closure
      if (currentSocket && currentMyPeerIdRef.current && roomJoined.current) {
        try {
          console.log(`Leaving random video call room: ${roomId}`);
          currentSocket.emit('leave-random-videocall', roomId, currentMyPeerIdRef.current);
          roomJoined.current = false;
        } catch (err) {
          console.warn('Error leaving socket room:', err);
        }
      }
    };
  }, [roomId, socket, isInitialized]); // FIXED: Removed myPeerId from dependencies
  
  const toggleAudio = () => {
    if (myStream.current) {
      const audioTrack = myStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };
  
  const toggleVideo = () => {
    if (myStream.current) {
      const videoTrack = myStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };
  
  const leaveCall = () => {
    navigate(-1);
  };
  
  const copyRoomLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
      .then(() => {
        alert('Room link copied to clipboard!');
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
      });
  };
  
  const requestMediaPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setHasMediaPermission(true);
      myStream.current = stream;
      
      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }
      
      // Update all existing peer connections with new stream
      Object.values(peersRef.current).forEach(call => {
        if (call && call.peerConnection) {
          // Replace tracks in existing connections
          const sender = call.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(stream.getVideoTracks()[0]);
          }
        }
      });
    } catch (err) {
      console.error('Failed to get media permission:', err);
      setError('Media access denied. You can still join the call to listen.');
    }
  };
  
  // Don't render if not properly initialized
  if (!roomId) {
    return <div>Invalid room</div>;
  }
  
  return (
    <div className="video-room-container">
      <div className="video-room-header">
        <h2>Video Call: {roomId}</h2>
        <div className="room-info">
          <span className="participant-count">👥 {participantCount} participant(s)</span>
          {isHost && <span className="host-badge">Host</span>}
        </div>
        <div className="room-actions">
          <button onClick={copyRoomLink} className="room-action-btn">
            📋 Copy Link
          </button>
          <button onClick={leaveCall} className="room-action-btn leave">
            🚪 Leave Call
          </button>
        </div>
      </div>
      
      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Setting up your video call...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={leaveCall}>Return</button>
        </div>
      )}
      
      {!hasMediaPermission && !isLoading && (
        <div className="permission-request">
          <h3>📹 Enable Camera & Microphone</h3>
          <p>To participate fully in the video call, please allow camera and microphone access.</p>
          <button onClick={requestMediaPermission} className="permission-btn">
            Enable Camera & Mic
          </button>
          <p><small>You can still join the call without media permissions to listen only.</small></p>
        </div>
      )}
      
      <div className="video-grid">
        <div className="video-container my-video">
          {hasMediaPermission ? (
            <video 
              ref={myVideo}
              muted
              autoPlay
              playsInline
              onLoadedMetadata={() => {
                if (myVideo.current) {
                  myVideo.current.play().catch(e => 
                    console.error("Error playing local video:", e)
                  );
                }
              }}
            />
          ) : (
            <div className="video-placeholder">
              <div className="placeholder-content">
                <span className="placeholder-icon">👤</span>
                <p>You (No Camera)</p>
              </div>
            </div>
          )}
          <div className="video-label">You {!hasMediaPermission && '(Audio Only)'}</div>
        </div>
        
        {Object.entries(peers).map(([peerId, stream]) => (
          <div key={peerId} className="video-container peer-video">
            <video
              autoPlay
              playsInline
              ref={video => {
                if (video && stream) {
                  video.srcObject = stream;
                  video.play().catch(e => 
                    console.error("Error playing peer video:", e)
                  );
                }
              }}
            />
            <div className="video-label">Participant {peerId.slice(0, 5)}</div>
          </div>
        ))}
        
        {/* Show empty slots for waiting */}
        {participantCount === 1 && (
          <div className="video-container waiting-slot">
            <div className="waiting-content">
              <span className="waiting-icon">⏳</span>
              <p>Waiting for others to join...</p>
              <small>Share the link to invite others</small>
            </div>
          </div>
        )}
      </div>
      
      <div className="video-controls">
        <button 
          onClick={toggleAudio} 
          className={`control-btn ${isMuted ? 'disabled' : ''}`}
          disabled={!hasMediaPermission}
        >
          {isMuted ? '🔇' : '🎤'} {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button 
          onClick={toggleVideo} 
          className={`control-btn ${isVideoOff ? 'disabled' : ''}`}
          disabled={!hasMediaPermission}
        >
          {isVideoOff ? '📹' : '📷'} {isVideoOff ? 'Show Video' : 'Hide Video'}
        </button>
        <button onClick={leaveCall} className="control-btn end-call">
          📞 End Call
        </button>
      </div>
    </div>
  );
};

export default RandomVideoCall;
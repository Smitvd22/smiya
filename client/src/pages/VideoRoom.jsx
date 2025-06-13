import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Peer } from 'peerjs';
import { useCall } from '../contexts/CallContext';
import '../styles/VideoRoom.css';

const VideoRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket } = useCall();
  
  const [myPeerId, setMyPeerId] = useState('');
  const [peers, setPeers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const myVideo = useRef();
  const myStream = useRef();
  const peerInstance = useRef();
  const peersRef = useRef({});
  
  // Server URLs
  const PEER_SERVER = process.env.REACT_APP_PEER_SERVER || 'your-render-server.onrender.com';
  const PEER_PORT = process.env.NODE_ENV === 'production' ? 443 : 5000;
  const PEER_PATH = '/peerjs';
  
  // Add a video element for a peer
  const addPeerVideo = (peerId, stream) => {
    setPeers(prevPeers => ({
      ...prevPeers,
      [peerId]: stream
    }));
  };
  
  // Remove a peer's video
  const removeVideo = (peerId) => {
    setPeers(prevPeers => {
      const updatedPeers = { ...prevPeers };
      delete updatedPeers[peerId];
      return updatedPeers;
    });
    
    // Also remove from ref
    delete peersRef.current[peerId];
  };
  
  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }
    
    // Create a local socket reference to use in cleanup
    const currentSocket = socket;
    
    // Define connectToNewUser inside the effect
    const connectToNewUser = (userId, stream) => {
      // Call the new user
      const call = peerInstance.current.call(userId, stream);
      
      // Handle receiving their stream
      call.on('stream', (userVideoStream) => {
        addPeerVideo(userId, userVideoStream);
      });
      
      // Handle call close
      call.on('close', () => {
        removeVideo(userId);
      });
      
      // Store call reference
      peersRef.current[userId] = call;
    };
    
    // Initialize video and socket connection
    const initializeRoom = async () => {
      try {
        setIsLoading(true);
        
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        myStream.current = stream;
        
        // Set up local video
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
        }
        
        // Initialize peer connection
        const peer = new Peer(undefined, {
          host: PEER_SERVER,
          port: process.env.NODE_ENV === 'production' ? 443 : 5000,
          path: PEER_PATH,
          secure: process.env.NODE_ENV === 'production'
        });
        
        peerInstance.current = peer;
        
        // Handle peer open event
        peer.on('open', (id) => {
          console.log('My peer ID:', id);
          setMyPeerId(id);
          
          // Join room with socket
          if (currentSocket) {
            currentSocket.emit('join-videoroom', roomId, id);
          }
        });
        
        // Handle incoming calls
        peer.on('call', (call) => {
          // Answer the call with our stream
          call.answer(stream);
          
          const peerId = call.peer;
          
          // Create video element for remote peer
          call.on('stream', (userVideoStream) => {
            // Add this peer if not already added
            if (!peersRef.current[peerId]) {
              addPeerVideo(peerId, userVideoStream);
            }
          });
          
          // Handle call close
          call.on('close', () => {
            removeVideo(peerId);
          });
          
          // Store call reference
          peersRef.current[peerId] = call;
        });
        
        // Handle errors
        peer.on('error', (err) => {
          console.error('Peer error:', err);
          setError(`Connection error: ${err.type}`);
        });
        
        // Socket event for new user
        if (currentSocket) {
          currentSocket.on('user-joined-videoroom', (userId) => {
            console.log('User joined:', userId);
            connectToNewUser(userId, stream);
          });
          
          // Socket event for user disconnect
          currentSocket.on('user-left-videoroom', (userId) => {
            console.log('User left:', userId);
            if (peersRef.current[userId]) {
              peersRef.current[userId].close();
              removeVideo(userId);
            }
          });
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error setting up video room:', err);
        setError(err.message || 'Could not access camera/microphone');
        setIsLoading(false);
      }
    };
    
    // Take a snapshot of peersRef at the beginning of the effect
    const initialPeersRef = peersRef.current;
    
    initializeRoom();
    
    // Cleanup function
    return () => {
      // Close all peer connections using the snapshot
      Object.values(initialPeersRef).forEach(call => {
        if (call && call.close) call.close();
      });
      
      // Stop all tracks
      if (myStream.current) {
        myStream.current.getTracks().forEach(track => track.stop());
      }
      
      // Close peer connection
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
      
      // Leave room - using the currentSocket reference
      if (currentSocket && myPeerId) {
        currentSocket.emit('leave-videoroom', roomId, myPeerId);
      }
      
      // Remove socket listeners - using the currentSocket reference
      if (currentSocket) {
        currentSocket.off('user-joined-videoroom');
        currentSocket.off('user-left-videoroom');
      }
    };
  }, [roomId, navigate, socket, PEER_SERVER, PEER_PORT, PEER_PATH, myPeerId]);
  
  // Toggle audio
  const toggleAudio = () => {
    if (myStream.current) {
      const audioTrack = myStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };
  
  // Toggle video
  const toggleVideo = () => {
    if (myStream.current) {
      const videoTrack = myStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };
  
  // Leave the room
  const leaveRoom = () => {
    navigate('/');
  };
  
  // Copy room link
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
  
  return (
    <div className="video-room-container">
      <div className="video-room-header">
        <h2>Video Room: {roomId}</h2>
        <div className="room-actions">
          <button onClick={copyRoomLink} className="room-action-btn">
            Copy Link
          </button>
          <button onClick={leaveRoom} className="room-action-btn leave">
            Leave Room
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
          <button onClick={leaveRoom}>Return Home</button>
        </div>
      )}
      
      <div className="video-grid">
        {/* My video */}
        <div className="video-container my-video">
          <video 
            ref={myVideo}
            muted
            autoPlay
            playsInline
            onLoadedMetadata={() => myVideo.current && myVideo.current.play()}
          />
          <div className="video-label">You</div>
        </div>
        
        {/* Peer videos */}
        {Object.entries(peers).map(([peerId, stream]) => (
          <div key={peerId} className="video-container peer-video">
            <video
              autoPlay
              playsInline
              ref={video => {
                if (video) video.srcObject = stream;
              }}
            />
            <div className="video-label">Peer {peerId.slice(0, 5)}</div>
          </div>
        ))}
      </div>
      
      <div className="video-controls">
        <button 
          onClick={toggleAudio} 
          className={`control-btn ${isMuted ? 'disabled' : ''}`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button 
          onClick={toggleVideo} 
          className={`control-btn ${isVideoOff ? 'disabled' : ''}`}
        >
          {isVideoOff ? 'Show Video' : 'Hide Video'}
        </button>
      </div>
    </div>
  );
};

export default VideoRoom;
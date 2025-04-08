import SimplePeer from 'simple-peer';

/**
 * Get user media with specified constraints
 * @param {Object} constraints - Media constraints
 * @returns {Promise<MediaStream>} Media stream
 */
export const getUserMedia = async (constraints = { video: true, audio: true }) => {
  console.log('Requesting user media with constraints:', constraints);
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('User media acquired successfully');
    return stream;
  } catch (error) {
    console.error('Error getting user media:', error);
    
    // For NotReadableError (device in use), try explicit device release and retry
    if (error.name === 'NotReadableError') {
      console.log('Forcing device release and retrying...');
      // Remove reference to undefined stream
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for device release
      
      try {
        // Try again with same constraints after device release
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (retryError) {
        // If retry fails, handle appropriately
        console.error('Retry failed:', retryError);
        throw retryError;
      }
    }
    
    throw error; // Re-throw the original error
  }
};

/**
 * Creates a WebRTC peer connection
 * @param {boolean} isInitiator - Whether this peer is the initiator
 * @param {MediaStream} stream - The local media stream (can be null)
 * @param {Function} onSignal - Callback for when signal is generated
 * @param {Function} onConnect - Callback for when connection is established
 * @param {Function} onStream - Callback for when remote stream is received
 * @param {Function} onClose - Callback for when connection is closed
 * @param {Function} onError - Callback for errors
 * @returns {Object} Peer connection object
 */
export function createPeer(isInitiator, stream, onSignal, onConnect, onStream, onClose, onError) {
  console.log(`Creating ${isInitiator ? 'initiator' : 'receiver'} peer with stream:`, 
              stream ? `Active (Audio tracks: ${stream.getAudioTracks().length}, Video tracks: ${stream.getVideoTracks().length})` : 'No stream');
  
  // Use consistent configuration
  const config = {
    initiator: isInitiator,
    trickle: true,
    stream: stream || undefined,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };
  
  const peer = new SimplePeer(config);
  
  // Listen for signals from the peer connection
  peer.on('signal', data => {
    console.log(`Signal generated for ${isInitiator ? 'initiator' : 'receiver'}:`, data.type || 'candidate');
    if (typeof onSignal === 'function') {
      onSignal(data);
    }
  });
  
  // Listen for connection establishment
  peer.on('connect', () => {
    console.log(`WebRTC peer connection ESTABLISHED for ${isInitiator ? 'initiator' : 'receiver'}`);
    if (typeof onConnect === 'function') {
      onConnect();
    }
  });
  
  // Listen for incoming stream
  peer.on('stream', remoteStream => {
    console.log(`STREAM RECEIVED from ${isInitiator ? 'receiver' : 'initiator'}:`, 
                `Audio tracks: ${remoteStream.getAudioTracks().length}`,
                `Video tracks: ${remoteStream.getVideoTracks().length}`);
    
    remoteStream.getTracks().forEach(track => {
      console.log(`Remote track: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
    });
    
    if (typeof onStream === 'function') {
      onStream(remoteStream);
    }
  });
  
  peer.on('error', err => {
    console.error(`Peer ${isInitiator ? 'initiator' : 'receiver'} error:`, err);
    
    // Filter out non-critical errors
    if (err.message && (
        err.message.includes('reading') || 
        err.message.includes('Cannot read properties of undefined'))) {
      console.warn('Non-critical error, continuing:', err.message);
    } else if (typeof onError === 'function') {
      onError(err);
    }
  });
  
  peer.on('close', () => {
    console.log(`Peer ${isInitiator ? 'initiator' : 'receiver'} connection closed`);
    if (typeof onClose === 'function') {
      onClose();
    }
  });
  
  // Monitor connection state for debugging
  if (peer._pc) {
    peer._pc.addEventListener('connectionstatechange', () => {
      console.log(`RTCPeerConnection state: ${peer._pc.connectionState}`);
    });
    
    peer._pc.addEventListener('iceconnectionstatechange', () => {
      console.log(`ICE connection state: ${peer._pc.iceConnectionState}`);
    });
  }
  
  return peer;
}

/**
 * Safely clean up media stream
 * @param {MediaStream} stream - Media stream to stop
 */
export const stopMediaStream = (stream) => {
  if (!stream) return;
  
  try {
    const tracks = stream.getTracks();
    tracks.forEach(track => {
      try {
        if (track.readyState === 'live') {
          track.stop();
        }
      } catch (err) {
        console.error("Error stopping track:", err);
      }
    });
  } catch (err) {
    console.error("Error stopping tracks:", err);
  }
};
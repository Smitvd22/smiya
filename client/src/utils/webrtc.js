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
    
    // For NotReadableError (device in use), try audio-only if video was requested
    if (error.name === 'NotReadableError' && constraints.video) {
      console.log('Attempting audio-only fallback');
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (audioError) {
        console.error('Audio fallback failed:', audioError);
      }
    }
    
    // Rethrow for caller to handle
    throw error;
  }
};

/**
 * Creates a WebRTC peer connection
 * @param {boolean} initiator - Whether this peer is the initiator
 * @param {MediaStream} stream - The local media stream (can be null)
 * @param {Function} onSignal - Callback for when signal is generated
 * @param {Function} onConnect - Callback for when connection is established
 * @param {Function} onStream - Callback for when remote stream is received
 * @param {Function} onClose - Callback for when connection is closed
 * @param {Function} onError - Callback for errors
 * @returns {Object} Peer connection object
 */
export const createPeer = (initiator, stream, onSignal, onConnect, onStream, onClose, onError) => {
  console.log(`Creating ${initiator ? 'initiator' : 'receiver'} peer with stream`);
  
  try {
    // Always ensure we have a valid stream object, even if empty
    const safeStream = stream || new MediaStream();
    
    const config = {
      initiator,
      trickle: true,
      stream: safeStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    };
    
    const peer = new SimplePeer(config);
    
    peer.on('signal', data => {
      console.log(`Signal generated for ${initiator ? 'initiator' : 'receiver'}:`, data);
      if (typeof onSignal === 'function') {
        onSignal(data);
      }
    });
    
    if (typeof onConnect === 'function') {
      peer.on('connect', onConnect);
    }
    
    if (typeof onStream === 'function') {
      peer.on('stream', onStream);
    }
    
    if (typeof onClose === 'function') {
      peer.on('close', onClose);
    }
    
    if (typeof onError === 'function') {
      peer.on('error', onError);
    }
    
    return peer;
  } catch (error) {
    console.error('Error creating peer:', error);
    if (typeof onError === 'function') {
      onError(error);
    }
    return null;
  }
};

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
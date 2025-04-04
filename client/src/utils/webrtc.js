import SimplePeer from 'simple-peer';

/**
 * Create a WebRTC peer connection
 */
export const createPeer = (initiator, stream, onSignal, onConnect, onStream, onClose, onError) => {
  try {
    console.log(`Creating ${initiator ? 'initiator' : 'receiver'} peer ${stream ? 'with stream' : 'without stream'}`);
    
    const peerOptions = {
      initiator,
      trickle: true,
      config: { 
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ] 
      }
    };

    // Only add stream if it's valid and has tracks
    if (stream && stream instanceof MediaStream && stream.getTracks && stream.getTracks().length > 0) {
      peerOptions.stream = stream;
    }

    const peer = new SimplePeer(peerOptions);

    // Safely add event handlers with error catching
    if (onSignal) peer.on('signal', data => {
      try { onSignal(data); } catch (e) { console.error("Signal handler error:", e); }
    });
    
    if (onConnect) peer.on('connect', () => {
      try { onConnect(); } catch (e) { console.error("Connect handler error:", e); }
    });
    
    if (onStream) peer.on('stream', remoteStream => {
      try { onStream(remoteStream); } catch (e) { console.error("Stream handler error:", e); }
    });
    
    if (onClose) peer.on('close', () => {
      try { onClose(); } catch (e) { console.error("Close handler error:", e); }
    });
    
    if (onError) peer.on('error', err => {
      try { onError(err); } catch (e) { console.error("Error handler handler error:", e); }
    });

    return peer;
  } catch (error) {
    console.error('Error creating peer:', error);
    if (onError) onError(error);
    throw error;
  }
};

/**
 * Helper function to get user media
 */
export const getUserMedia = async (constraints = { video: true, audio: true }) => {
  try {
    console.log('Requesting user media with constraints:', constraints);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('User media acquired successfully');
    return stream;
  } catch (error) {
    console.error('Error getting user media:', error);
    // Return empty stream instead of null to avoid errors
    return new MediaStream();
  }
};

/**
 * Safely clean up media stream
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
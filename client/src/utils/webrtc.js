import SimplePeer from 'simple-peer';

/**
 * Create a WebRTC peer connection
 * @param {boolean} initiator - Whether this peer is the initiator
 * @param {MediaStream} stream - Local media stream to share
 * @param {Function} onSignal - Callback when signaling data is available
 * @param {Function} onConnect - Callback when connection is established
 * @param {Function} onStream - Callback when remote stream is received
 * @param {Function} onClose - Callback when connection is closed
 * @param {Function} onError - Callback when error occurs
 * @returns {SimplePeer} The peer connection object
 */
export const createPeer = (initiator, stream, onSignal, onConnect, onStream, onClose, onError) => {
  const peer = new SimplePeer({
    initiator,
    stream,
    trickle: true,
    config: { 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ] 
    }
  });

  peer.on('signal', data => {
    if (onSignal) onSignal(data);
  });

  peer.on('connect', () => {
    if (onConnect) onConnect();
  });

  peer.on('stream', remoteStream => {
    if (onStream) onStream(remoteStream);
  });

  peer.on('close', () => {
    if (onClose) onClose();
  });

  peer.on('error', err => {
    if (onError) onError(err);
  });

  return peer;
};

/**
 * Helper function to get user media
 * @param {Object} constraints - Media constraints
 * @returns {Promise<MediaStream>} Media stream
 */
export const getUserMedia = async (constraints = { video: true, audio: true }) => {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    console.error('Error accessing media devices:', error);
    throw error;
  }
};
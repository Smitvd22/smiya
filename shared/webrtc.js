import Peer from 'simple-peer';

/**
 * Create a WebRTC peer connection
 * @param {boolean} initiator - Whether this peer is the initiator
 * @param {MediaStream} stream - Local media stream to share
 * @param {Function} onSignal - Callback when signaling data is available
 * @param {Function} onConnect - Callback when connection is established
 * @param {Function} onStream - Callback when remote stream is received
 * @param {Function} onClose - Callback when connection is closed
 * @param {Function} onError - Callback when error occurs
 * @returns {Peer} The peer connection object
 */
export const createPeer = (initiator, stream, onSignal, onConnect, onStream, onClose, onError) => {
  try {
    console.log(`Creating ${initiator ? 'initiator' : 'receiver'} peer with stream:`, stream);
    
    const peer = new Peer({
      initiator,
      stream,
      trickle: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    // Add all event handlers
    if (onSignal) peer.on('signal', onSignal);
    if (onConnect) peer.on('connect', onConnect);
    if (onStream) peer.on('stream', onStream);
    if (onClose) peer.on('close', onClose);
    if (onError) peer.on('error', onError);

    console.log(`${initiator ? 'Initiator' : 'Receiver'} peer created successfully`);
    return peer;
  } catch (error) {
    console.error('Error creating peer:', error);
    if (onError) onError(error);
    throw error;
  }
};

/**
 * Helper function to get user media
 * @returns {Promise<MediaStream>} Media stream
 */
export const getUserMedia = async () => {
  try {
    console.log('Requesting user media');
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    console.log('User media acquired successfully');
    return stream;
  } catch (error) {
    console.error('Error getting user media:', error);
    throw error;
  }
};
import SimplePeer from 'simple-peer';

export const createPeer = (initiator, stream) => {
  const peer = new SimplePeer({
    initiator,
    stream,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  });

  peer.on('signal', (data) => {
    // Emit signal via Socket.io (implement in frontend)
  });

  return peer;
};
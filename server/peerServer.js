import { PeerServer } from 'peer';

export const setupPeerServer = (server) => {
  if (process.env.NODE_ENV === 'development') {
    const peerServer = PeerServer({
      port: 9000,
      path: '/peerjs',
      allow_discovery: true,
      debug: true
    });
    
    console.log('🎥 PeerJS Server running on port 9000');
    
    peerServer.on('connection', (client) => {
      console.log('PeerJS client connected:', client.getId());
    });
    
    peerServer.on('disconnect', (client) => {
      console.log('PeerJS client disconnected:', client.getId());
    });
  }
};
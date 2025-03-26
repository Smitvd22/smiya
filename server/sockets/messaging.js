import { Server } from 'socket.io';

export const initSockets = (server) => {
  const io = new Server(server, {
    cors: { origin: '*' } // Allow all for testing
  });

  io.on('connection', (socket) => {
    // Messaging
    socket.on('message', (data) => {
      io.emit('message', data); // Broadcast to all
    });

    // WebRTC Signaling
    socket.on('call-signal', (data) => {
      socket.broadcast.emit('call-signal', data); // Relay signals
    });
  });
};
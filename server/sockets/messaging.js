import { Server } from 'socket.io';

export const initSockets = (server, app) => {
  const io = new Server(server, {
    cors: { origin: '*' } // In production, set this to your frontend URL
  });
  
  // Make io available in routes
  app.set('io', io);

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join a specific chat room (for private messaging)
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room: ${roomId}`);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};
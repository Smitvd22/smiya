import { Server } from 'socket.io';

/**
 * Sets up Socket.IO with all messaging and calling functionality
 * @param {Server} io - The Socket.IO server instance
 */
export const setupSocketIO = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // ====== ROOM MANAGEMENT ======
    
    // Join a specific chat room (for private messaging)
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room: ${roomId}`);
    });
    
    // Join personal room for receiving calls
    socket.on('join-user-room', (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room: ${roomId}`);
    });
    
    // ====== MESSAGING FUNCTIONALITY ======
    
    // Handle new message events (needed if clients emit messages directly through socket)
    socket.on('send-message', (message) => {
      const chatRoom = [message.senderId, message.receiverId].sort().join('-');
      io.to(chatRoom).emit('new-message', message);
      console.log(`Message sent in room ${chatRoom}`);
    });
    
    // ====== USER PRESENCE ======
    
    // Handle user online status (optional enhancement)
    socket.on('set-status', (status) => {
      // Store user status if needed
      socket.broadcast.emit('user-status-change', {
        userId: socket.userId,
        status: status
      });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });

    // ====== PING FUNCTIONALITY ======

    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback();
      }
    });
  });
};

/**
 * Initialize Socket.IO with the Express server
 * @param {http.Server} server - HTTP server instance
 * @param {Express} app - Express application instance
 */
export const initializeSocketIO = (server, app) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST']
    }
  });
  
  // Store io instance in app for use in other parts of the application
  app.set('io', io);
  
  // Setup socket handlers
  setupSocketIO(io);
  
  return io;
};
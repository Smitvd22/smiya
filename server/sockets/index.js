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
    
    // ====== VIDEO CALLING FUNCTIONALITY ======
    
    // Initiate a call to another user
    socket.on('call-user', (data) => {
      const { userId, signalData, from, fromUsername } = data;
      console.log(`Call from ${from} to ${userId}, emitting to room: user-${userId}`);
      
      // Make sure we're sending to the correct room format
      io.to(`user-${userId}`).emit('incoming-call', {
        signal: signalData,
        from,
        fromUsername
      });
    });
    
    // Accept an incoming call
    socket.on('answer-call', (data) => {
      const { signal, to } = data;
      console.log(`Call answered by ${socket.id} to ${to}`);
      io.to(`user-${to}`).emit('call-accepted', signal);
    });
    
    // Reject an incoming call
    socket.on('reject-call', (data) => {
      const { to } = data;
      console.log(`Call rejected by ${socket.id} to ${to}`);
      io.to(`user-${to}`).emit('call-rejected');
    });
    
    // End an ongoing call
    socket.on('end-call', (data) => {
      const { to } = data;
      console.log(`Call ended by ${socket.id} to ${to}`);
      
      // Emit to recipient
      io.to(`user-${to}`).emit('call-ended');
      
      // Clear socket room associations if needed
      if (socket.userId) {
        socket.leave(`call-${to}-${socket.userId}`);
        socket.leave(`call-${socket.userId}-${to}`);
      }
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
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"]
    }
  });
  
  // Make io available to the Express app
  app.set('io', io);
  
  // Set up socket.io with our handlers
  setupSocketIO(io);
  
  return io;
};
import { Server } from 'socket.io';

/**
 * Sets up Socket.IO with all messaging and calling functionality
 * @param {Server} io - The Socket.IO server instance
 */
export const setupSocketIO = (io) => {
  // Helper function to find a user's socket by their user ID
  const findUserSocket = (userId) => {
    // Convert userId to string for comparison
    const userIdStr = userId.toString();
    
    // Search through all connected sockets to find the one with matching userId
    for (const [socketId, socket] of io.sockets.sockets) {
      if (socket.userId === userIdStr) {
        return socket;
      }
    }
    return null;
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // ====== ROOM MANAGEMENT ======
    
    // Join a specific chat room (for private messaging)
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room: ${roomId}`);
    });
    
    // Join personal room for receiving calls and store user ID
    socket.on('join-user-room', (roomId) => {
      socket.join(roomId);
      // Extract user ID from room format "user-{id}"
      const userId = roomId.replace('user-', '');
      socket.userId = userId;
      console.log(`Socket ${socket.id} joined room: ${roomId}, userId: ${userId}`);
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

    // ====== VIDEO CALL FUNCTIONALITY ======

    // Handle video call invitations
    socket.on('video-call-invitation', (data) => {
      const { callId, fromUserId, toUserId, fromUsername } = data;
      
      console.log(`Video call invitation from ${fromUserId} to ${toUserId}`);
      
      // Find the target user's socket using the helper function
      const targetSocket = findUserSocket(toUserId);
      if (targetSocket) {
        console.log(`Sending video call invitation to socket ${targetSocket.id}`);
        targetSocket.emit('video-call-invitation', {
          callId,
          fromUserId,
          fromUsername
        });
      } else {
        console.log(`Target user ${toUserId} not found online`);
        // Optionally notify the caller that the user is offline
        socket.emit('video-call-error', {
          error: 'User is not online',
          callId
        });
      }
    });

    // Join a video call
    socket.on('join-video-call', (callId, peerId) => {
      // Check if already in room to prevent duplicate joins
      const currentRooms = Array.from(socket.rooms);
      if (!currentRooms.includes(callId)) {
        console.log(`Socket ${socket.id} joining video call ${callId} with peer ID ${peerId}`);
        socket.join(callId);
        socket.to(callId).emit('user-joined-video-call', peerId);
      } else {
        console.log(`Socket ${socket.id} already in room ${callId}, skipping join`);
      }
    });

    // Leave a video call
    socket.on('leave-video-call', (callId) => {
      console.log(`Socket ${socket.id} leaving video call ${callId}`);
      socket.to(callId).emit('user-left-video-call', socket.id);
      socket.leave(callId);
    });

    // ====== RANDOM VIDEO CALL FUNCTIONALITY ======
    
    // Join random video call
    socket.on('join-random-videocall', (roomId, peerId) => {
      console.log(`Socket ${socket.id} joining random video call ${roomId} with peer ID ${peerId}`);
      socket.join(roomId);
      socket.to(roomId).emit('user-joined-random-videocall', peerId);
    });

    // Leave random video call
    socket.on('leave-random-videocall', (roomId) => {
      console.log(`Socket ${socket.id} leaving random video call ${roomId}`);
      socket.to(roomId).emit('user-left-random-videocall', socket.id);
      socket.leave(roomId);
    });
  });
};

/**
 * Initialize Socket.IO with the Express server
 * @param {http.Server} server - HTTP server instance
 * @param {Express} app - Express application instance
 */
export const initializeSocketIO = (server, app) => {
  const corsOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'https://smiya.onrender.com'];
    
  const io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  
  console.log('🔌 Socket.IO configured with CORS origins:', corsOrigins);
  
  // Store io instance in app for use in other parts of the application
  app.set('io', io);
  
  // Setup socket handlers
  setupSocketIO(io);
  
  return io;
};
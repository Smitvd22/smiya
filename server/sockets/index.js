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
    
    // Join a video call - FIXED: Better handling to prevent early leaves
    socket.on('join-video-call', (callId, peerId) => {
      try {
        console.log(`Socket ${socket.id} attempting to join video call ${callId} with peer ID ${peerId}`);
        
        // Store the peer ID on the socket BEFORE joining
        socket.peerId = peerId;
        socket.currentCallId = callId;
        
        // Check if already in room
        const currentRooms = Array.from(socket.rooms);
        if (currentRooms.includes(callId)) {
          console.log(`Socket ${socket.id} already in room ${callId}, updating peer ID`);
          // Just update the peer ID and notify
          socket.to(callId).emit('user-joined-video-call', peerId);
          return;
        }
        
        // Join the room
        socket.join(callId);
        console.log(`Socket ${socket.id} successfully joined video call ${callId}`);
        
        // Get room info
        const room = io.sockets.adapter.rooms.get(callId);
        const roomSize = room ? room.size : 0;
        
        console.log(`Room ${callId} now has ${roomSize} participants`);
        
        // Send confirmation to the joiner
        socket.emit('video-call-joined', { 
          callId, 
          peerId, 
          roomSize,
          success: true 
        });
        
        // If there are other participants, notify them and send existing participants to new joiner
        if (roomSize > 1) {
          // Notify existing users about new participant
          socket.to(callId).emit('user-joined-video-call', peerId);
          console.log(`Notified ${roomSize - 1} users about new participant ${peerId}`);
          
          // Send existing participants to the new joiner
          const existingPeers = [];
          room.forEach(socketId => {
            const existingSocket = io.sockets.sockets.get(socketId);
            if (existingSocket && existingSocket.peerId && existingSocket.peerId !== peerId) {
              existingPeers.push(existingSocket.peerId);
            }
          });
          
          if (existingPeers.length > 0) {
            // Small delay to ensure the peer is ready
            setTimeout(() => {
              socket.emit('existing-participants', existingPeers);
            }, 500);
          }
        }
      } catch (error) {
        console.error(`Error joining video call ${callId}:`, error);
        socket.emit('video-call-error', { error: 'Failed to join call' });
      }
    });

    // FIXED: Better leave handling - only leave if actually in the call
    socket.on('leave-video-call', (callId) => {
      if (socket.currentCallId === callId) {
        console.log(`Socket ${socket.id} leaving video call ${callId}`);
        socket.to(callId).emit('user-left-video-call', socket.peerId || socket.id);
        socket.leave(callId);
        socket.currentCallId = null;
        socket.peerId = null;
      }
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

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      // If user was in a video call, notify others
      if (socket.currentCallId && socket.peerId) {
        socket.to(socket.currentCallId).emit('user-left-video-call', socket.peerId);
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
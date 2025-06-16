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
    
    // Modify the call-user handler to distinguish between offer and ICE candidates
    socket.on('call-user', (data) => {
      const { userId, signalData, from, fromUsername } = data;
      
      // Only log room creation for initial offer, not for ICE candidates
      if (signalData.type === 'offer') {
        console.log(`Call initiated from ${from} to ${userId}, emitting to room: user-${userId}`);
        
        // Create a unique room for this call
        const callRoom = `${userId}-${from}`;
        socket.join(callRoom);
        console.log(`Created and joined call room: ${callRoom}`);
      }
      
      // Emit call data to recipient with signal type info for debugging
      io.to(`user-${userId}`).emit('incoming-call', {
        signal: signalData,
        from,
        fromUsername,
        signalType: signalData.type || 'ice-candidate' // For debugging
      });
    });
    
    // Enhance answer-call handler
    socket.on('answer-call', (data, callback) => {
      const { signal, to } = data;
      
      // Enhanced logging with verification
      console.log(`Answer from ${socket.id} (user ${socket.userId}) to ${to}:`, 
                  signal ? `signal type: ${signal.type || 'candidate'}` : 'missing signal');
      
      // Validate the signal data
      if (!signal) {
        console.error('Invalid answer signal: empty data');
        if (callback) callback({ status: 'error', message: 'Invalid signal data' });
        return;
      }
      
      // Validate the recipient
      if (!to) {
        console.error('Invalid answer call: missing recipient');
        if (callback) callback({ status: 'error', message: 'Missing recipient' });
        return;
      }
      
      // Send acknowledgment back to caller
      if (callback && typeof callback === 'function') {
        callback({
          status: 'ok', 
          message: 'Answer signal received'
        });
      }
      
      // Forward the signal to the caller
      io.to(`user-${to}`).emit('call-accepted', signal);
      
      // Add users to call room for better tracking
      const callRoom = `call-${to}-${socket.userId || 'unknown'}`;
      socket.join(callRoom);
      console.log(`Added users to call room: ${callRoom}`);
    });
    
    // Enhance the signal-update handler in the server
    socket.on('signal-update', async (data) => {
      const { to, signal, from } = data;
      
      if (!to || !signal) {
        console.error("Invalid signal-update data:", data);
        return;
      }

      console.log(`Forwarding signal update from ${from} to ${to}, type: ${signal.type || 'ICE candidate'}`);
      
      try {
        // Make sure the target user's room exists
        const targetRoom = `user-${to}`;
        
        // Forward the signal to the specific user's room
        io.to(targetRoom).emit('call-signal-update', {
          signal,
          from,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('Error forwarding signal:', err);
      }
    });
    
    // Reject an incoming call
    socket.on('reject-call', (data) => {
      const { to } = data;
      console.log(`Call rejected by ${socket.id} to ${to}`);
      io.to(`user-${to}`).emit('call-rejected');
    });
    
    // End an ongoing call
    socket.on('end-call', (data, callback) => {
      const { to } = data;
      console.log(`Call ended by ${socket.id} to ${to}`);
      
      // Add acknowledgment callback
      if (callback && typeof callback === 'function') {
        callback({ status: 'ok', message: 'End call signal received' });
      }
      
      // Emit to recipient only if in a valid format
      if (to && typeof to === 'string' || typeof to === 'number') {
        console.log(`Notifying user-${to} about call end`);
        io.to(`user-${to}`).emit('call-ended');
        
        // Clear socket room associations if needed
        if (socket.userId) {
          socket.leave(`call-${to}-${socket.userId}`);
          socket.leave(`call-${socket.userId}-${to}`);
        }
      } else {
        console.error("Invalid recipient ID for end-call:", to);
      }
    });
    
    // ====== RANDOM VIDEO CALLING FUNCTIONALITY ======
    
    // Handle joining random video call room
    socket.on('join-random-videocall', (roomId, peerId) => {
      console.log(`User ${socket.id} joining random video call room: ${roomId} with peer ID: ${peerId}`);
      
      // Store the room and peer info
      socket.randomVideoRoomId = roomId;
      socket.randomPeerId = peerId;
      socket.userId = socket.userId || socket.id; // Fallback to socket ID if no user ID
      
      // Join the room
      socket.join(`random-videocall-${roomId}`);
      
      // Notify others in the room
      socket.to(`random-videocall-${roomId}`).emit('user-joined-random-videocall', peerId);
      
      console.log(`User ${socket.id} joined random video call room: random-videocall-${roomId}`);
    });
    
    // Handle leaving random video call room
    socket.on('leave-random-videocall', (roomId, peerId) => {
      console.log(`User ${socket.id} leaving random video call room: ${roomId}`);
      
      if (socket.randomVideoRoomId) {
        // Notify others in the room
        socket.to(`random-videocall-${socket.randomVideoRoomId}`).emit('user-left-random-videocall', socket.randomPeerId);
        
        // Leave the room
        socket.leave(`random-videocall-${socket.randomVideoRoomId}`);
        
        // Clear room info
        socket.randomVideoRoomId = null;
        socket.randomPeerId = null;
      }
    });
    
    // Handle getting room participants
    socket.on('get-room-participants', (roomId, callback) => {
      const room = io.sockets.adapter.rooms.get(`random-videocall-${roomId}`);
      const participantCount = room ? room.size : 0;
      
      if (typeof callback === 'function') {
        callback({ participantCount });
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
      
      // Notify video room peers if needed
      if (socket.videoRoomId && socket.peerId) {
        socket.to(`videoroom-${socket.videoRoomId}`).emit('user-left-videoroom', socket.peerId);
      }
      
      // Notify random video call peers if needed - IMPROVED
      if (socket.randomVideoRoomId && socket.randomPeerId) {
        console.log(`User disconnected from random video call: ${socket.randomVideoRoomId}`);
        socket.to(`random-videocall-${socket.randomVideoRoomId}`).emit('user-left-random-videocall', socket.randomPeerId);
        
        // Clean up the room data
        socket.randomVideoRoomId = null;
        socket.randomPeerId = null;
      }
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
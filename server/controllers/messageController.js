import { pool } from '../config/db.js';

// Get chat history with a specific user (with pagination)
export const getChatHistory = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.user.userId;
  
  // Extract pagination parameters, default to page 1 with 20 messages per page
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  try {
    // Get messages where current user is sender OR receiver
    const result = await pool.query(
      `SELECT * FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2)
       OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, friendId, limit, offset]
    );
    
    // Map DB column names to camelCase for frontend
    const messages = result.rows.map(msg => ({
      id: msg.id,
      content: msg.content,
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      createdAt: msg.created_at
    }));
    
    // Note: We're returning messages in DESC order to get the most recent first
    // but we need to reverse them for display (oldest first)
    res.status(200).json(messages.reverse());
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
};

// Send a new message
export const sendMessage = async (req, res) => {
  const { content, receiverId } = req.body;
  const senderId = req.user.userId;
  
  if (!content || !receiverId) {
    return res.status(400).json({ error: 'Message content and receiver ID are required' });
  }
  
  try {
    // Insert message into database
    const result = await pool.query(
      `INSERT INTO messages (content, sender_id, receiver_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [content, senderId, receiverId]
    );
    
    const newMessage = {
      id: result.rows[0].id,
      content: result.rows[0].content,
      senderId: result.rows[0].sender_id,
      receiverId: result.rows[0].receiver_id,
      createdAt: result.rows[0].created_at
    };
    
    // Emit to socket (will be handled in socket setup)
    const io = req.app.get('io');
    const chatRoom = [senderId, receiverId].sort().join('-');
    io.to(chatRoom).emit('new-message', newMessage);
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};
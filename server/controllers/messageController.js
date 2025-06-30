import { pool } from '../config/db.js';
import { v2 as cloudinary } from 'cloudinary';

// Get chat history with a specific user (with pagination)
export const getChatHistory = async (req, res) => {
  const { friendId } = req.params;
  const userId = req.user.userId;
  
  // Extract pagination parameters, default to page 1 with 20 messages per page
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  try {
    // First get messages
    const messagesResult = await pool.query(
      `SELECT * FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2)
       OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, friendId, limit, offset]
    );
    
    // Get message IDs for fetching reactions
    const messageIds = messagesResult.rows.map(msg => msg.id);
    
    // Get reactions for these messages if there are any messages
    let reactionsResult = { rows: [] };
    if (messageIds.length > 0) {
      reactionsResult = await pool.query(
        `SELECT r.*, u.username 
         FROM message_reactions r
         JOIN users u ON r.user_id = u.id
         WHERE r.message_id = ANY($1)
         ORDER BY r.created_at ASC`,
        [messageIds]
      );
    }
    
    // Group reactions by message ID
    const reactionsByMessageId = {};
    reactionsResult.rows.forEach(reaction => {
      const messageId = reaction.message_id;
      if (!reactionsByMessageId[messageId]) {
        reactionsByMessageId[messageId] = [];
      }
      reactionsByMessageId[messageId].push({
        id: reaction.id,
        userId: reaction.user_id,
        username: reaction.username,
        emoji: reaction.emoji,
        emojiName: reaction.emoji_name
      });
    });
    
    // Map DB column names to camelCase for frontend and include reactions
    const messages = messagesResult.rows.map(msg => ({
      id: msg.id,
      content: msg.content,
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      replyToId: msg.reply_to_id,
      mediaUrl: msg.media_url,
      mediaType: msg.media_type,
      mediaPublicId: msg.media_public_id, 
      mediaFormat: msg.media_format,
      createdAt: msg.created_at,
      reactions: reactionsByMessageId[msg.id] || []
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
  const { content, receiverId, replyToId } = req.body;
  const senderId = req.user.userId;
  
  if (!content || !receiverId) {
    return res.status(400).json({ error: 'Message content and receiver ID are required' });
  }
  
  try {
    // Insert message into database with replyToId
    const result = await pool.query(
      `INSERT INTO messages (content, sender_id, receiver_id, reply_to_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [content, senderId, receiverId, replyToId]
    );
    
    const newMessage = {
      id: result.rows[0].id,
      content: result.rows[0].content,
      senderId: result.rows[0].sender_id,
      receiverId: result.rows[0].receiver_id,
      replyToId: result.rows[0].reply_to_id,
      mediaUrl: result.rows[0].media_url,
      mediaType: result.rows[0].media_type,
      mediaPublicId: result.rows[0].media_public_id,
      mediaFormat: result.rows[0].media_format,
      createdAt: result.rows[0].created_at
    };
    
    // Emit to socket
    const io = req.app.get('io');
    const chatRoom = [senderId, receiverId].sort().join('-');
    io.to(chatRoom).emit('new-message', newMessage);
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// Send a media message
export const sendMediaMessage = async (req, res) => {
  const { mediaUrl, mediaType, publicId, format, receiverId } = req.body;
  const senderId = req.user.userId;
  
  if (!mediaUrl || !mediaType || !receiverId) {
    return res.status(400).json({ error: 'Media URL, type, and receiver ID are required' });
  }
  
  try {
    // Insert media message into database
    const result = await pool.query(
      `INSERT INTO messages (content, sender_id, receiver_id, media_url, media_type, media_public_id, media_format)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      ['', senderId, receiverId, mediaUrl, mediaType, publicId, format]
    );
    
    const newMessage = {
      id: result.rows[0].id,
      content: result.rows[0].content,
      senderId: result.rows[0].sender_id,
      receiverId: result.rows[0].receiver_id,
      mediaUrl: result.rows[0].media_url,
      mediaType: result.rows[0].media_type,
      mediaPublicId: result.rows[0].media_public_id,
      mediaFormat: result.rows[0].media_format,
      createdAt: result.rows[0].created_at
    };
    
    // Emit to socket
    const io = req.app.get('io');
    const chatRoom = [senderId, receiverId].sort().join('-');
    io.to(chatRoom).emit('new-message', newMessage);
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send media message error:', error);
    res.status(500).json({ error: 'Failed to send media message' });
  }
};

// Add a reaction to a message
export const addReaction = async (req, res) => {
  const { messageId, emoji, emojiName } = req.body;
  const userId = req.user.userId;
  
  if (!messageId || !emoji) {
    return res.status(400).json({ error: 'Message ID and emoji are required' });
  }
  
  try {
    // Check if the user already reacted with this emoji to this message
    const existingReaction = await pool.query(
      `SELECT * FROM message_reactions 
       WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji]
    );
    
    if (existingReaction.rows.length > 0) {
      // Remove the reaction if it already exists (toggle behavior)
      await pool.query(
        `DELETE FROM message_reactions 
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [messageId, userId, emoji]
      );
      
      // Get user info for the response
      const userInfo = await pool.query(
        `SELECT username FROM users WHERE id = $1`,
        [userId]
      );
      
      const reactionData = {
        id: existingReaction.rows[0].id,
        messageId,
        userId,
        username: userInfo.rows[0].username,
        emoji,
        emojiName,
        removed: true
      };
      
      // Emit event to socket
      const io = req.app.get('io');
      io.to(`message-${messageId}`).emit('reaction-removed', reactionData);
      
      return res.status(200).json({ message: 'Reaction removed', reaction: reactionData });
    }
    
    // Add new reaction
    const result = await pool.query(
      `INSERT INTO message_reactions (message_id, user_id, emoji, emoji_name, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [messageId, userId, emoji, emojiName]
    );
    
    // Get user info for the response
    const userInfo = await pool.query(
      `SELECT username FROM users WHERE id = $1`,
      [userId]
    );
    
    const reactionData = {
      id: result.rows[0].id,
      messageId,
      userId,
      username: userInfo.rows[0].username,
      emoji,
      emojiName
    };
    
    // Emit to socket
    const io = req.app.get('io');
    io.to(`message-${messageId}`).emit('new-reaction', reactionData);
    
    res.status(201).json(reactionData);
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
};

// Get reactions for a message
export const getReactions = async (req, res) => {
  const { messageId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT r.*, u.username 
       FROM message_reactions r
       JOIN users u ON r.user_id = u.id
       WHERE r.message_id = $1
       ORDER BY r.created_at ASC`,
      [messageId]
    );
    
    const reactions = result.rows.map(row => ({
      id: row.id,
      messageId: row.message_id,
      userId: row.user_id,
      username: row.username,
      emoji: row.emoji,
      emojiName: row.emoji_name,
      createdAt: row.created_at
    }));
    
    res.status(200).json(reactions);
  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({ error: 'Failed to get reactions' });
  }
};
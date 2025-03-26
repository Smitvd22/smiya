import { pool } from '../config/db.js';

export const getFriends = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email 
       FROM users u
       JOIN friendships f ON (u.id = f.user2_id AND f.user1_id = $1) OR (u.id = f.user1_id AND f.user2_id = $1)
       WHERE f.status = 'accepted'`,
      [req.user.userId]
    );
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to retrieve friends' });
  }
};

export const addFriend = async (req, res) => {
  const { userId } = req.params;
  
  // Prevent adding self as friend
  if (req.user.userId === parseInt(userId)) {
    return res.status(400).json({ error: "You cannot add yourself as a friend" });
  }
  
  try {
    // Check if friendship already exists
    const existingFriendship = await pool.query(
      `SELECT * FROM friendships 
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [req.user.userId, userId]
    );
    
    if (existingFriendship.rows.length > 0) {
      return res.status(409).json({ error: "Friend request already exists" });
    }
    
    // Add friend request
    await pool.query(
      'INSERT INTO friendships (user1_id, user2_id, status, created_at) VALUES ($1, $2, $3, NOW())',
      [req.user.userId, userId, 'pending']
    );
    
    res.status(201).json({ message: "Friend request sent" });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
};

export const removeFriend = async (req, res) => {
  const { userId } = req.params;
  
  try {
    await pool.query(
      `DELETE FROM friendships 
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [req.user.userId, userId]
    );
    
    res.status(200).json({ message: "Friend removed successfully" });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
};
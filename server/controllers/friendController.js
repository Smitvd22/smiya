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

// Get pending friend requests
export const getFriendRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, u.username, u.email, u.id as user_id 
       FROM users u
       JOIN friendships f ON u.id = f.user1_id
       WHERE f.user2_id = $1 AND f.status = 'pending'`,
      [req.user.userId]
    );
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to retrieve friend requests' });
  }
};

// Accept a friend request
export const acceptFriendRequest = async (req, res) => {
  const { requestId } = req.params;
  
  try {
    // First verify this request is for the current user
    const request = await pool.query(
      `SELECT * FROM friendships WHERE id = $1 AND user2_id = $2 AND status = 'pending'`,
      [requestId, req.user.userId]
    );
    
    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    
    // Update the friendship status
    await pool.query(
      `UPDATE friendships SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
      [requestId]
    );
    
    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
};

// Reject a friend request
export const rejectFriendRequest = async (req, res) => {
  const { requestId } = req.params;
  
  try {
    // First verify this request is for the current user
    const request = await pool.query(
      `SELECT * FROM friendships WHERE id = $1 AND user2_id = $2 AND status = 'pending'`,
      [requestId, req.user.userId]
    );
    
    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    
    // Delete the friend request
    await pool.query(
      `DELETE FROM friendships WHERE id = $1`,
      [requestId]
    );
    
    res.status(200).json({ message: "Friend request rejected" });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
};
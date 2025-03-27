import { pool } from '../config/db.js';

export const searchUsers = async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }
  
  try {
    // Search for users by username or email, excluding the current user
    const result = await pool.query(
      `SELECT id, username, email 
       FROM users 
       WHERE (username ILIKE $1 OR email ILIKE $1) AND id != $2`,
      [`%${q}%`, req.user.userId]
    );
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search for users' });
  }
};
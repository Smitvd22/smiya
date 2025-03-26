import { pool } from '../config/db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Hash password with SHA-256 (for demonstration - use bcrypt in production)
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

export const register = async (req, res) => {
  const { username, email, mobile, password } = req.body;
  
  if (!username || !email || !mobile || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Hash the password before storing
    const hashedPassword = hashPassword(password);
    
    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (username, email, mobile, password) VALUES ($1, $2, $3, $4) RETURNING id, username, email, mobile',
      [username, email, mobile, hashedPassword]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: result.rows[0].id, username: result.rows[0].username },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        mobile: result.rows[0].mobile
      },
      token
    });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      let field = 'an unknown field';
      if (error.detail.includes('username')) field = 'username';
      else if (error.detail.includes('email')) field = 'email';
      else if (error.detail.includes('mobile')) field = 'mobile number';
      
      return res.status(409).json({ error: `The ${field} is already in use` });
    }
    
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login = async (req, res) => {
  const { identifier, password } = req.body;
  
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifier and password are required' });
  }
  
  try {
    // Check if the identifier matches username, email, or mobile
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1 OR mobile = $1',
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );
    
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        mobile: user.mobile
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to authenticate' });
  }
};
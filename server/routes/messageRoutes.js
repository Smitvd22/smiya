import express from 'express';
import { getChatHistory, sendMessage, sendMediaMessage } from '../controllers/messageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Existing routes
router.get('/:friendId', getChatHistory);
router.post('/', sendMessage);

// New route for media messages
router.post('/media', sendMediaMessage);

export default router;
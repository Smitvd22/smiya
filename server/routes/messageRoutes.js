import express from 'express';
import { getChatHistory, sendMessage, sendMediaMessage, addReaction, getReactions } from '../controllers/messageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Existing routes
router.get('/:friendId', getChatHistory);
router.post('/', sendMessage);
router.post('/media', sendMediaMessage);

// New routes for reactions
router.post('/reactions', addReaction);
router.get('/reactions/:messageId', getReactions);

export default router;
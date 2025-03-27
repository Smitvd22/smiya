import express from 'express';
import { getChatHistory, sendMessage } from '../controllers/messageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

router.get('/:friendId', getChatHistory);
router.post('/', sendMessage);

export default router;
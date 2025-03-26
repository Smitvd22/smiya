import express from 'express';
import { getFriends, addFriend, removeFriend } from '../controllers/friendController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

router.get('/', getFriends);
router.post('/:userId', addFriend);
router.delete('/:userId', removeFriend);

export default router;
import express from 'express';
import { 
  getFriends, 
  addFriend, 
  removeFriend, 
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest 
} from '../controllers/friendController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

router.get('/', getFriends);
router.post('/:userId', addFriend);
router.delete('/:userId', removeFriend);
router.get('/requests', getFriendRequests);
router.put('/requests/:requestId/accept', acceptFriendRequest);
router.put('/requests/:requestId/reject', rejectFriendRequest);

export default router;
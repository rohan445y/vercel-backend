import { Router } from 'express';
import { SupportTicket } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendResponse } from '../utils/helpers';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  const tickets = await SupportTicket.find({ user: req.user!._id }).sort({ createdAt: -1 });
  return sendResponse(res, 200, 'Tickets fetched', { tickets });
});

router.post('/', async (req: AuthRequest, res) => {
  const { subject, category, message, priority } = req.body;
  const ticket = await SupportTicket.create({
    user: req.user!._id,
    subject,
    category: category || 'general',
    priority: priority || 'medium',
    messages: [{ sender: req.user!._id, senderRole: 'user', message }],
  });
  return sendResponse(res, 201, 'Ticket created', { ticket });
});

router.post('/:id/reply', async (req: AuthRequest, res) => {
  const ticket = await SupportTicket.findOneAndUpdate(
    { _id: req.params.id, user: req.user!._id },
    { $push: { messages: { sender: req.user!._id, senderRole: 'user', message: req.body.message } } },
    { new: true }
  );
  return sendResponse(res, 200, 'Reply sent', { ticket });
});

export default router;

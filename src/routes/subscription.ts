import { Router } from 'express';
import { Plan, Subscription, Wallet } from '../models';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendResponse, generateTransactionId } from '../utils/helpers';
import { debitWallet, createNotification } from '../services/walletService';
import { processReferralCommission } from '../services/referralService';

const router = Router();

router.get('/plans', async (_req, res) => {
  const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 });
  return sendResponse(res, 200, 'Plans fetched', { plans });
});

router.use(authenticate);

router.get('/my', async (req: AuthRequest, res) => {
  const subscription = await Subscription.findOne({ user: req.user!._id, status: 'active' }).populate('plan');
  return sendResponse(res, 200, 'Subscription fetched', { subscription });
});

router.post('/purchase/:planId', async (req: AuthRequest, res) => {
  try {
    const plan = await Plan.findById(req.params.planId);
    if (!plan || !plan.isActive) return sendResponse(res, 404, 'Plan not found');

    const existing = await Subscription.findOne({ user: req.user!._id, status: 'active' });
    if (existing) return sendResponse(res, 400, 'You already have an active subscription');

    const wallet = await Wallet.findOne({ user: req.user!._id });
    if (!wallet || wallet.balance < plan.price) {
      return sendResponse(res, 400, 'Insufficient wallet balance');
    }

    await debitWallet(req.user!._id.toString(), plan.price, 'subscription', `Purchased ${plan.name} plan`);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    const subscription = await Subscription.create({
      user: req.user!._id,
      plan: plan._id,
      status: 'active',
      startDate,
      endDate,
      amount: plan.price,
      transactionId: generateTransactionId('SUB'),
    });

    if (plan.badge) {
      req.user!.badges = [...(req.user!.badges || []), plan.badge];
      await req.user!.save();
    }

    await processReferralCommission(req.user!._id.toString(), subscription._id.toString(), plan._id.toString(), plan.price);

    await createNotification(
      req.user!._id.toString(),
      'Subscription Activated',
      `Your ${plan.name} membership is now active!`,
      'subscription'
    );

    return sendResponse(res, 201, 'Subscription purchased', { subscription: await subscription.populate('plan') });
  } catch (err) {
    return sendResponse(res, 500, (err as Error).message);
  }
});

export default router;

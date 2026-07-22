import { Referral, ReferralCommission, User, Plan, Subscription } from '../models';
import { creditWallet, createNotification } from './walletService';

export async function processReferralCommission(
  referredUserId: string,
  subscriptionId: string,
  planId: string,
  amount: number
) {
  const referred = await User.findById(referredUserId);
  if (!referred?.referredBy) return null;

  const referrer = await User.findById(referred.referredBy);
  if (!referrer) return null;

  const plan = await Plan.findById(planId);
  if (!plan) return null;

  const referrerSub = await Subscription.findOne({ user: referrer._id, status: 'active' }).populate('plan');
  const commissionRate = referrerSub && referrerSub.plan ? (referrerSub.plan as any).commission : 0;
  const commissionAmount = Math.round((amount * commissionRate) / 100);

  const commission = await ReferralCommission.create({
    referrer: referrer._id,
    referred: referred._id,
    subscription: subscriptionId,
    plan: planId,
    amount,
    commissionRate,
    commissionAmount,
    level: 1,
    status: 'paid',
  });

  await Referral.findOneAndUpdate(
    { referrer: referrer._id, referred: referred._id },
    { $inc: { totalCommission: commissionAmount, totalPurchases: 1 }, isActive: true },
    { upsert: true }
  );

  await creditWallet(
    referrer._id.toString(),
    commissionAmount,
    'referral',
    `Referral commission from ${referred.username}`,
    { referredUserId, subscriptionId }
  );

  await createNotification(
    referrer._id.toString(),
    'Referral Commission Earned',
    `You earned NPR ${commissionAmount} from ${referred.username}'s subscription purchase.`,
    'referral',
    '/dashboard/referral'
  );

  return commission;
}

export async function getReferralStats(userId: string) {
  const referrals = await Referral.find({ referrer: userId }).populate('referred', 'name username email createdAt');
  const active = referrals.filter((r) => r.isActive).length;
  const totalCommission = referrals.reduce((sum, r) => sum + r.totalCommission, 0);

  return {
    total: referrals.length,
    active,
    inactive: referrals.length - active,
    totalCommission,
    referrals,
  };
}

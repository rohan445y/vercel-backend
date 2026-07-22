import { Wallet, Transaction, Notification } from '../models';
import { generateTransactionId } from '../utils/helpers';

export async function creditWallet(
  userId: string,
  amount: number,
  type: 'deposit' | 'referral' | 'bonus' | 'adjustment',
  remarks?: string,
  metadata?: Record<string, unknown>
) {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.isFrozen) throw new Error('Wallet is frozen');

  wallet.balance += amount;
  wallet.withdrawableBalance += amount;
  if (type === 'deposit') wallet.totalDeposited += amount;
  if (type === 'referral' || type === 'bonus') wallet.totalEarned += amount;
  await wallet.save();

  const txn = await Transaction.create({
    transactionId: generateTransactionId(),
    user: userId,
    type,
    amount,
    status: 'completed',
    remarks,
    metadata,
  });

  return { wallet, txn };
}

export async function debitWallet(
  userId: string,
  amount: number,
  type: 'withdraw' | 'subscription' | 'adjustment',
  remarks?: string,
  metadata?: Record<string, unknown>
) {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.isFrozen) throw new Error('Wallet is frozen');
  if (wallet.withdrawableBalance < amount) throw new Error('Insufficient balance');

  wallet.balance -= amount;
  wallet.withdrawableBalance -= amount;
  if (type === 'withdraw') wallet.totalWithdrawn += amount;
  await wallet.save();

  const txn = await Transaction.create({
    transactionId: generateTransactionId(),
    user: userId,
    type,
    amount: -amount,
    status: 'completed',
    remarks,
    metadata,
  });

  return { wallet, txn };
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'deposit' | 'withdraw' | 'subscription' | 'referral' | 'announcement' | 'system',
  link?: string
) {
  return Notification.create({ user: userId, title, message, type, link });
}

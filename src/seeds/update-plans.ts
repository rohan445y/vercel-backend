import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../config/database';
import { Plan } from '../models';

async function updatePlans() {
  try {
    await connectDB();
    console.log('Updating plan durations in database...');
    const result = await Plan.updateMany(
      { duration: 365 },
      { $set: { duration: 30 } }
    );
    console.log(`Successfully updated ${result.modifiedCount} plans to 30 days.`);
  } catch (error) {
    console.error('Error migrating plan durations:', error);
  } finally {
    await disconnectDB();
  }
}

updatePlans().catch(console.error);

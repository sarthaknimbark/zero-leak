import { Router } from 'express';
import { checkAndSendReminders } from '../jobs/sendReminders.js';
import { requireCronSecret } from '../middleware/requireCronSecret.js';

export const remindersRouter = Router();

remindersRouter.post('/internal/send-reminders', requireCronSecret, async (_req, res, next) => {
  try {
    const summary = await checkAndSendReminders();
    res.json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
});

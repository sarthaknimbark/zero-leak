import express from 'express';
import { env } from './config/env.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { remindersRouter } from './routes/reminders.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { accountsRouter } from './routes/accounts.js';
import { categoriesRouter } from './routes/categories.js';
import { transactionsRouter } from './routes/transactions.js';
import { transfersRouter } from './routes/transfers.js';
import { billsRouter } from './routes/bills.js';
import { savingGoalsRouter } from './routes/savingGoals.js';
import { debtsRouter } from './routes/debts.js';
import { notificationsRouter } from './routes/notifications.js';
import { adminRouter } from './routes/admin.js';
import { dashboardRouter } from './routes/dashboard.js';

const app = express();

app.disable('x-powered-by');
app.use(corsMiddleware);
app.use(express.json({ limit: '256kb' }));

app.use(healthRouter);
app.use(remindersRouter);

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/bills', billsRouter);
app.use('/api/saving-goals', savingGoalsRouter);
app.use('/api/debts', debtsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/dashboard', dashboardRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`zero-leak-server listening on :${env.port} (${env.nodeEnv})`);
  console.log(`Allowed origins: ${env.allowedOrigins.join(', ')}`);
});

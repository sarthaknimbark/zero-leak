import webpush from 'web-push';
import { requireVapidConfig } from '../config/env.js';
import { supabase } from '../lib/supabase.js';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const vapid = requireVapidConfig();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  vapidConfigured = true;
}

export type ReminderResult = {
  scannedBills: number;
  dueBills: number;
  sent: number;
  skippedNoSubscription: number;
  failed: number;
  clearedSubscriptions: number;
};

type BillRow = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_date: string;
  due_time: string | null;
  status: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  push_subscription: webpush.PushSubscription | null;
};

/**
 * Same behavior as client/send_reminders.js — read-only on bills/profiles except:
 * - insert into notifications
 * - clear invalid push_subscription
 * Does not modify accounts, transactions, or bill payment status.
 */
export async function checkAndSendReminders(): Promise<ReminderResult> {
  ensureVapid();

  const result: ReminderResult = {
    scannedBills: 0,
    dueBills: 0,
    sent: 0,
    skippedNoSubscription: 0,
    failed: 0,
    clearedSubscriptions: 0,
  };

  console.log(`[${new Date().toISOString()}] Scanning for unpaid bills...`);

  const { data: bills, error: billsError } = await supabase
    .from('bills')
    .select('*')
    .neq('status', 'paid');

  if (billsError) throw billsError;

  const billRows = (bills ?? []) as BillRow[];
  result.scannedBills = billRows.length;

  if (billRows.length === 0) {
    console.log('No unpaid bills found.');
    return result;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, push_subscription')
    .not('push_subscription', 'is', null);

  if (profilesError) throw profilesError;

  const profileRows = (profiles ?? []) as ProfileRow[];
  const now = new Date();

  const activeDueBills = billRows.filter((bill) => {
    const combinedDateTime = new Date(`${bill.due_date}T${bill.due_time || '12:00:00'}`);
    return combinedDateTime <= now;
  });

  result.dueBills = activeDueBills.length;

  if (activeDueBills.length === 0) {
    console.log('No active due or overdue bills currently trigger reminders.');
    return result;
  }

  console.log(`Found ${activeDueBills.length} unpaid bill(s) due/overdue.`);

  for (const bill of activeDueBills) {
    const profile = profileRows.find((p) => p.id === bill.user_id);
    if (!profile?.push_subscription) {
      result.skippedNoSubscription += 1;
      console.log(`User for bill "${bill.name}" has no push subscription.`);
      continue;
    }

    const payload = JSON.stringify({
      title: 'Zero Leak — Bill Reminder',
      body: `Your "${bill.name}" bill of ₹${bill.amount} is unpaid! Mark it as paid to stop reminders.`,
      url: '/bills',
    });

    console.log(`Sending push reminder to ${profile.email} for bill "${bill.name}"...`);

    try {
      await webpush.sendNotification(profile.push_subscription, payload);
      result.sent += 1;

      await supabase.from('notifications').insert({
        user_id: bill.user_id,
        title: 'Bill Reminder 🚨',
        body: `Your "${bill.name}" bill of ₹${bill.amount} is unpaid!`,
        type: 'bill',
        read: false,
      });
    } catch (err) {
      result.failed += 1;
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode: number }).statusCode)
          : undefined;
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error sending push notification:', message);

      if (statusCode === 410 || statusCode === 404) {
        await supabase.from('profiles').update({ push_subscription: null }).eq('id', profile.id);
        result.clearedSubscriptions += 1;
      }
    }
  }

  return result;
}

async function runCli() {
  const watch = process.argv.includes('--watch') || process.argv.includes('watch');

  if (watch) {
    console.log('Starting Zero Leak Reminder Service (every 15 minutes)...');
    await checkAndSendReminders();
    setInterval(() => {
      void checkAndSendReminders().catch((err) => {
        console.error('Failed to process reminders:', err instanceof Error ? err.message : err);
      });
    }, 15 * 60 * 1000);
    return;
  }

  try {
    const summary = await checkAndSendReminders();
    console.log('Reminder run complete:', summary);
  } catch (err) {
    console.error('Failed to process reminders:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1]?.includes('sendReminders') || process.argv[1]?.endsWith('sendReminders.ts');

if (isDirectRun) {
  void runCli();
}

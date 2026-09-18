import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// VAPID keys for Web Push (matching client hook VAPID key)
const VAPID_PUBLIC_KEY = 'BLRDmTUkWXSM5WwcP6xyjfYPmL-sHIJO1LfeEQxBbOt3TKsF11JTpH14UZDpOxlZR4FozkRxUW3vs0xPFdDUunQ';
// We generate a private key specifically for signing local test runs
const VAPID_PRIVATE_KEY = '9eW1xZr3FPTcWbrXsYSByZuyGcobNDt2LX_H_Ij3fys';

// Setup keys
webpush.setVapidDetails(
  'mailto:support@zeroleak.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Read .env manually
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  const envLines = envContent.split('\n');
  let serviceRoleKey = '';
  let anonKey = '';
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = trimmed.split('VITE_SUPABASE_URL=')[1].trim();
    }
    if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      serviceRoleKey = trimmed.split('SUPABASE_SERVICE_ROLE_KEY=')[1].trim();
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      anonKey = trimmed.split('VITE_SUPABASE_ANON_KEY=')[1].trim();
    }
  }
  supabaseKey = serviceRoleKey || anonKey;
  if (!serviceRoleKey) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY not found in .env. Using VITE_SUPABASE_ANON_KEY instead.');
    console.warn('\x1b[33m%s\x1b[0m', '   Row Level Security (RLS) will block the script from fetching bills unless authenticated.');
  }
} catch (e) {
  supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or Key is missing.');
  process.exit(1);
}

// Create Supabase Admin client
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndSendReminders() {
  console.log(`[${new Date().toLocaleTimeString()}] Scanning for unpaid bills...`);

  try {
    // 1. Fetch all unpaid/overdue bills
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .neq('status', 'paid');

    if (billsError) throw billsError;
    console.log(`Fetched ${bills?.length || 0} unpaid/overdue bills from database:`, bills);
    if (!bills || bills.length === 0) {
      console.log('No unpaid bills found.');
      return;
    }

    // Fetch all profiles with push subscriptions
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .not('push_subscription', 'is', null);

    if (profilesError) throw profilesError;

    const now = new Date();
    const activeDueBills = bills.filter(bill => {
      // Combine due_date ('YYYY-MM-DD') and due_time ('HH:MM:SS')
      const combinedDateTime = new Date(`${bill.due_date}T${bill.due_time || '12:00:00'}`);
      return combinedDateTime <= now;
    });

    if (activeDueBills.length === 0) {
      console.log('No active due or overdue bills currently trigger reminders.');
      return;
    }

    console.log(`Found ${activeDueBills.length} unpaid bill(s) due/overdue.`);

    // 2. Iterate through bills and trigger push notifications to subscribed users
    for (const bill of activeDueBills) {
      const profile = (profiles ?? []).find(p => p.id === bill.user_id);
      if (!profile || !profile.push_subscription) {
        console.log(`User for bill "${bill.name}" has not registered a push notification subscription.`);
        continue;
      }

      const subscription = profile.push_subscription;
      const payload = JSON.stringify({
        title: 'Zero Leak — Bill Reminder',
        body: `Your "${bill.name}" bill of ₹${bill.amount} is unpaid! Mark it as paid to stop reminders.`,
        url: '/bills'
      });

      console.log(`Sending push reminder to ${profile.email} for bill "${bill.name}"...`);

      try {
        await webpush.sendNotification(subscription, payload);
        console.log('Push notification sent successfully.');

        // Save in-app notification Center entry
        await supabase.from('notifications').insert({
          user_id: bill.user_id,
          title: 'Bill Reminder 🚨',
          body: `Your "${bill.name}" bill of ₹${bill.amount} is unpaid!`,
          type: 'bill',
          read: false
        });
        console.log('In-app notification saved successfully.');
      } catch (err) {
        console.error('Error sending push notification:', err.message);
        // If subscription is expired or invalid, we can optionally clear it in DB
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log('Push subscription is invalid or expired. Removing from profile.');
          await supabase.from('profiles').update({ push_subscription: null }).eq('id', profile.id);
        }
      }
    }
  } catch (err) {
    console.error('Failed to process reminders:', err.message);
  }
}

// Run mode
const mode = process.argv[2];
if (mode === 'watch') {
  console.log('Starting Zero Leak Reminder Service Daemon...');
  console.log('Will check and send reminders every 15 minutes.');
  
  // Initial check
  checkAndSendReminders();
  
  // Polling every 15 minutes
  setInterval(checkAndSendReminders, 15 * 60 * 1000);
} else {
  // Single execution run
  checkAndSendReminders();
}

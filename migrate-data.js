import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually to avoid extra dependencies
let supabaseUrl = '';
let supabaseAnonKey = '';

try {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = trimmed.split('VITE_SUPABASE_URL=')[1].trim();
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = trimmed.split('VITE_SUPABASE_ANON_KEY=')[1].trim();
    }
  }
} catch (e) {
  console.warn('Could not read .env file, checking process.env...');
  supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your .env file.');
  process.exit(1);
}

const args = process.argv.slice(2);
const mode = args[0]; // 'export' or 'import'
const email = args[1];
const password = args[2];

if (!mode || !email || !password || (mode !== 'export' && mode !== 'import')) {
  console.log('Usage:');
  console.log('  node migrate-data.js export <email> <password>');
  console.log('  node migrate-data.js import <email> <password>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log(`Connecting to Supabase URL: ${supabaseUrl}`);
  
  // 1. Sign in to authenticate and get the session token (helps bypass RLS)
  console.log(`Authenticating as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    // If importing, maybe the user hasn't registered yet, let's try to sign them up
    if (mode === 'import') {
      console.log('Authentication failed. Attempting to sign up user in the new database...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        console.error('Sign up failed:', signUpError.message);
        process.exit(1);
      }
      console.log('Successfully registered user in the new database.');
      // Sign in now
      const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (retryError) {
        console.error('Retried sign in failed:', retryError.message);
        process.exit(1);
      }
      // Re-use session
      supabase.auth.setSession(retryData.session);
    } else {
      console.error('Authentication failed:', authError.message);
      process.exit(1);
    }
  }

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) {
    console.error('Could not retrieve user ID.');
    process.exit(1);
  }
  console.log(`Authenticated. User ID: ${userId}`);

  const backupFilePath = path.join(process.cwd(), 'data-backup.json');

  if (mode === 'export') {
    console.log('Starting export...');
    
    // Fetch profiles
    const { data: profiles, error: profileErr } = await supabase.from('profiles').select('*');
    if (profileErr) console.warn('Warning fetching profiles:', profileErr.message);

    // Fetch custom categories
    const { data: categories, error: catErr } = await supabase.from('categories').select('*');
    if (catErr) console.error('Error fetching categories:', catErr.message);

    // Fetch accounts
    const { data: accounts, error: accErr } = await supabase.from('accounts').select('*');
    if (accErr) console.error('Error fetching accounts:', accErr.message);

    // Fetch transactions
    const { data: transactions, error: txErr } = await supabase.from('transactions').select('*');
    if (txErr) console.error('Error fetching transactions:', txErr.message);

    // Fetch transfers
    const { data: transfers, error: tfErr } = await supabase.from('transfers').select('*');
    if (tfErr) console.error('Error fetching transfers:', tfErr.message);

    const backupData = {
      user_id: userId,
      profiles: profiles || [],
      categories: categories || [],
      accounts: accounts || [],
      transactions: transactions || [],
      transfers: transfers || []
    };

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
    console.log(`Export completed! Backup saved to: ${backupFilePath}`);
    console.log(`Summary:`);
    console.log(`  Categories: ${backupData.categories.length}`);
    console.log(`  Accounts: ${backupData.accounts.length}`);
    console.log(`  Transactions: ${backupData.transactions.length}`);
    console.log(`  Transfers: ${backupData.transfers.length}`);

  } else if (mode === 'import') {
    console.log('Starting import...');
    if (!fs.existsSync(backupFilePath)) {
      console.error(`Backup file not found at: ${backupFilePath}. Run export first.`);
      process.exit(1);
    }

    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    const oldUserId = backupData.user_id;
    console.log(`Read backup file. Mapping old User ID (${oldUserId}) to new User ID (${userId}).`);

    // Fetch existing categories in the new DB (both default and custom)
    const { data: newDbCategories, error: fetchCatsErr } = await supabase.from('categories').select('*');
    if (fetchCatsErr) {
      console.error('Error fetching categories from new DB:', fetchCatsErr.message);
      process.exit(1);
    }

    // Map to keep track of old_id -> new_id
    const categoryIdMap = {};

    // 1. Restore Profile info (optional/update defaults)
    if (backupData.profiles.length > 0) {
      console.log('Restoring profile custom settings...');
      const profile = backupData.profiles.find(p => p.id === userId || p.id === oldUserId);
      if (profile) {
        const profileUpdate = { ...profile };
        delete profileUpdate.id; // Let DB handle ID reference or update the matching profile id
        if (profileUpdate.user_id === oldUserId) profileUpdate.user_id = userId;
        const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', userId);
        if (error) console.warn('Could not update profile details:', error.message);
      }
    }

    // 2. Restore categories
    console.log('Processing and restoring categories...');
    const categoriesToInsert = [];

    for (const oldCat of backupData.categories) {
      // Find if this category already exists in the new DB by name & type
      const match = newDbCategories.find(c => 
        c.name.toLowerCase() === oldCat.name.toLowerCase() && 
        c.type === oldCat.type &&
        (c.user_id === userId || c.user_id === null)
      );

      if (match) {
        // If matched, map old ID to existing ID in the new DB
        categoryIdMap[oldCat.id] = match.id;
      } else {
        // If not matched (e.g. it's a custom category that doesn't exist yet)
        const newCat = { ...oldCat };
        if (newCat.user_id === oldUserId) newCat.user_id = userId;
        categoriesToInsert.push(newCat);
      }
    }

    if (categoriesToInsert.length > 0) {
      console.log(`Inserting ${categoriesToInsert.length} custom categories...`);
      const { data: insertedCats, error: insertCatsErr } = await supabase
        .from('categories')
        .insert(categoriesToInsert)
        .select();

      if (insertCatsErr) {
        console.error('Error inserting custom categories:', insertCatsErr.message);
      } else if (insertedCats) {
        // Map the newly inserted categories
        insertedCats.forEach(c => {
          const original = categoriesToInsert.find(orig => orig.name === c.name && orig.type === c.type);
          if (original) {
            categoryIdMap[original.id] = c.id;
          }
        });
      }
    }

    // Helper function to map user_id on records
    const mapUser = (records) => {
      return records.map(r => {
        const mapped = { ...r };
        if (mapped.user_id === oldUserId) {
          mapped.user_id = userId;
        }
        return mapped;
      });
    };

    // 3. Restore accounts
    if (backupData.accounts.length > 0) {
      console.log('Restoring accounts...');
      const userAccounts = mapUser(backupData.accounts);
      const { error } = await supabase.from('accounts').upsert(userAccounts, { onConflict: 'id' });
      if (error) console.error('Error inserting accounts:', error.message);
    }

    // 4. Restore transactions
    if (backupData.transactions.length > 0) {
      console.log('Restoring transactions with category mapping...');
      const userTransactions = mapUser(backupData.transactions).map(tx => {
        const mappedTx = { ...tx };
        if (mappedTx.category_id && categoryIdMap[mappedTx.category_id]) {
          mappedTx.category_id = categoryIdMap[mappedTx.category_id];
        }
        return mappedTx;
      });
      
      const { error } = await supabase.from('transactions').upsert(userTransactions, { onConflict: 'id' });
      if (error) console.error('Error inserting transactions:', error.message);
    }

    // 5. Restore transfers
    if (backupData.transfers.length > 0) {
      console.log('Restoring transfers...');
      const userTransfers = mapUser(backupData.transfers);
      const { error } = await supabase.from('transfers').upsert(userTransfers, { onConflict: 'id' });
      if (error) console.error('Error inserting transfers:', error.message);
    }

    console.log('Import completed successfully!');
  }
}

main().catch(err => {
  console.error('Execution error:', err);
});

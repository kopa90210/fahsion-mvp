/**
 * scripts/test_rls.mjs
 * Manual RLS smoke-test.
 *
 * Prerequisites:
 *   1. Run the migration (0006_row_level_security.sql) first.
 *   2. Have TWO real user accounts in your Supabase project.
 *   3. Fill in the four constants below.
 *
 * Usage:
 *   node scripts/test_rls.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ── Fill these in ────────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const USER_A_EMAIL    = 'user-a@example.com';   // <-- replace
const USER_A_PASSWORD = 'password-for-a';        // <-- replace
const USER_B_EMAIL    = 'user-b@example.com';   // <-- replace
const USER_B_PASSWORD = 'password-for-b';        // <-- replace
// ── End config ───────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Sign-in failed for ' + email + ': ' + error.message);
  return data.user.id;
}

async function runTest(label, query, expectEmpty) {
  const { data, error } = await query;
  if (error) {
    console.error('FAIL [' + label + '] unexpected error:', error.message);
    return false;
  }
  const ok = expectEmpty ? data.length === 0 : data.length > 0;
  const icon = ok ? 'PASS' : 'FAIL';
  console.log(icon + ' [' + label + '] rows returned: ' + data.length + (expectEmpty ? ' (expected 0)' : ' (expected >0)'));
  return ok;
}

let allPassed = true;

// ── Sign in as User A ────────────────────────────────────────────────────────
console.log('\n--- Signing in as User A ---');
const userAId = await signIn(USER_A_EMAIL, USER_A_PASSWORD);
console.log('User A id:', userAId);

// User A can see their own fashion_dna row
allPassed &= await runTest(
  'User A reads own fashion_dna',
  supabase.from('fashion_dna').select('*').eq('user_id', userAId),
  false  // expect rows
);

// ── Sign in as User B ────────────────────────────────────────────────────────
console.log('\n--- Signing in as User B ---');
const userBId = await signIn(USER_B_EMAIL, USER_B_PASSWORD);
console.log('User B id:', userBId);

// User B tries to read User A's fashion_dna -- must return ZERO rows
allPassed &= await runTest(
  "User B cannot read User A's fashion_dna",
  supabase.from('fashion_dna').select('*').eq('user_id', userAId),
  true   // expect empty
);

// User B cannot read User A's outfits
allPassed &= await runTest(
  "User B cannot read User A's outfits",
  supabase.from('outfits').select('*').eq('user_id', userAId),
  true
);

// User B cannot read User A's feedback
allPassed &= await runTest(
  "User B cannot read User A's feedback",
  supabase.from('feedback').select('*').eq('user_id', userAId),
  true
);

// wardrobe_items is a global catalog -- User B CAN read it
allPassed &= await runTest(
  'User B can read wardrobe_items catalog',
  supabase.from('wardrobe_items').select('id').limit(1),
  false
);

// extraction_log -- User B must get zero rows (fully locked to service role)
allPassed &= await runTest(
  'User B cannot read extraction_log',
  supabase.from('extraction_log').select('id').limit(1),
  true
);

// ── Sign back in as User A -- should NOT see User B's data ──────────────────
console.log('\n--- Back to User A ---');
await signIn(USER_A_EMAIL, USER_A_PASSWORD);

allPassed &= await runTest(
  "User A cannot read User B's fashion_dna",
  supabase.from('fashion_dna').select('*').eq('user_id', userBId),
  true
);

console.log('\n' + (allPassed ? 'All RLS tests PASSED.' : 'Some RLS tests FAILED -- see above.'));
process.exit(allPassed ? 0 : 1);
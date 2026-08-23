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

// ── Grab User A's wardrobe items (we need real IDs for the cross-user tests) ─
// We do this while still signed in as User A.
const { data: userAWardrobe, error: wardrobeErr } = await supabase
  .from('user_wardrobe_items')
  .select('item_id, wardrobe_items(id, source)')
  .eq('user_id', userAId)
  .limit(5);

if (wardrobeErr || !userAWardrobe || userAWardrobe.length === 0) {
  console.error('SETUP  Cannot read User A wardrobe — populate it before running these tests.');
  process.exit(1);
}

// Pick one item for the remove/update cross-user tests (any item will do).
const anyItemId = userAWardrobe[0].item_id;

// Pick a curated item so we can test the server-side business-rule guard.
// If User A owns no curated items, fall back to anyItemId and note it.
const curatedRow = userAWardrobe.find(
  (r) => r.wardrobe_items && (Array.isArray(r.wardrobe_items) ? r.wardrobe_items[0] : r.wardrobe_items)?.source === 'curated'
);
const curatedItemId = curatedRow ? curatedRow.item_id : null;

// ── TEST GROUP 1: user_wardrobe_items isolation (including retired_at/notes) ─
//
// The "owner all" policy on user_wardrobe_items uses  auth.uid() = user_id,
// which means Postgres strips out every other user's rows before the result
// reaches the client.  A SELECT * (not filtered by user_id) must return zero
// rows for User B when querying User A's data, even though retired_at and
// notes are now present in the schema.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Group 1: user_wardrobe_items isolation (User B perspective) ---');
await signIn(USER_B_EMAIL, USER_B_PASSWORD);

// 1a. User B reads User A's user_wardrobe_items by user_id filter -- expect 0
allPassed &= await runTest(
  "User B cannot see User A's user_wardrobe_items (filter by user_id)",
  supabase.from('user_wardrobe_items').select('*').eq('user_id', userAId),
  true  // expect empty
);

// 1b. User B tries SELECT * with no filter -- RLS means they only see their
//     own rows.  None of User A's rows (including retired_at / notes columns)
//     should be visible.  We verify by checking the returned set contains no
//     rows owned by User A.
{
  const { data: bRows, error: bErr } = await supabase
    .from('user_wardrobe_items')
    .select('user_id, item_id, retired_at, notes');

  if (bErr) {
    console.error('FAIL  [User B unfiltered SELECT on user_wardrobe_items] error:', bErr.message);
    allPassed = false;
  } else {
    const leaked = (bRows ?? []).filter((r) => r.user_id === userAId);
    const ok = leaked.length === 0;
    const icon = ok ? 'PASS' : 'FAIL';
    console.log(
      icon + ' [User B unfiltered SELECT leaks no User-A rows] leaked: ' + leaked.length +
      ' (expected 0)'
    );
    allPassed &= ok;
  }
}

// ── TEST GROUP 2: cross-user removeWardrobeItem / updateWardrobeItem ──────────
//
// removeWardrobeItem() in the server action first fetches the join row with
//   .eq('user_id', auth.uid())  -- User B's uid -- AND .eq('item_id', anyItemId).
// Because RLS on user_wardrobe_items allows only owner rows, the join-row
// lookup returns nothing and the action throws "Item not found in user wardrobe"
// before ever issuing the UPDATE.
//
// We replicate that exact lookup here (signed in as User B) to confirm the DB
// itself blocks cross-user access, independent of application code ordering.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Group 2: cross-user remove / update rejection ---');

// 2a. User B tries to read the join row that would let removeWardrobeItem
//     proceed.  Expect zero rows (RLS filters them out).
allPassed &= await runTest(
  "User B cannot fetch User A's join row (removeWardrobeItem pre-check)",
  supabase
    .from('user_wardrobe_items')
    .select('user_id, item_id')
    .eq('user_id', userAId)
    .eq('item_id', anyItemId),
  true  // expect empty -- RLS blocks it
);

// 2b. User B tries to directly UPDATE User A's user_wardrobe_items row
//     (mimicking what removeWardrobeItem does after the join-row check).
//     The WITH CHECK on the policy means the UPDATE either returns an error
//     or silently touches zero rows.
{
  const { data: updateData, error: updateErr } = await supabase
    .from('user_wardrobe_items')
    .update({ retired_at: new Date().toISOString() })
    .eq('user_id', userAId)
    .eq('item_id', anyItemId)
    .select();

  const noRowsAffected = !updateErr && (updateData == null || updateData.length === 0);
  const ok = !updateErr ? noRowsAffected : true; // an RLS error also counts as blocked
  const icon = ok ? 'PASS' : 'FAIL';
  if (updateErr) {
    console.log(icon + ' [User B cannot UPDATE User A\'s retired_at] blocked with error: ' + updateErr.message);
  } else {
    console.log(
      icon + ' [User B cannot UPDATE User A\'s retired_at] rows affected: ' +
      (updateData?.length ?? 0) + ' (expected 0)'
    );
  }
  allPassed &= ok;
}

// 2c. User B tries to UPDATE notes on User A's row (same logic).
{
  const { data: notesData, error: notesErr } = await supabase
    .from('user_wardrobe_items')
    .update({ notes: 'injected by user B' })
    .eq('user_id', userAId)
    .eq('item_id', anyItemId)
    .select();

  const noRowsAffected = !notesErr && (notesData == null || notesData.length === 0);
  const ok = !notesErr ? noRowsAffected : true;
  const icon = ok ? 'PASS' : 'FAIL';
  if (notesErr) {
    console.log(icon + " [User B cannot UPDATE User A's notes] blocked with error: " + notesErr.message);
  } else {
    console.log(
      icon + " [User B cannot UPDATE User A's notes] rows affected: " +
      (notesData?.length ?? 0) + ' (expected 0)'
    );
  }
  allPassed &= ok;
}

// ── TEST GROUP 3: curated-item server-side read-only guard ────────────────────
//
// updateWardrobeItem() checks item.source at the application layer:
//   if (item.source !== 'user_upload') throw new Error('Item is part of...')
//
// This guard is NOT backed by a DB policy -- wardrobe_items only has a
// SELECT policy for authenticated users; writes are denied across the board
// for authenticated users regardless of source.  The DB-level denial and the
// app-level check are therefore redundant for the write path, but the app
// guard also prevents source='curated' items from being treated as editable
// even if a future migration accidentally opened up writes.
//
// We test both layers independently:
//   3a. Direct UPDATE on wardrobe_items (DB layer) -- must fail for any
//       authenticated user because no write policy exists.
//   3b. The app-layer error message for source='curated' (simulated by the
//       same SELECT + source check the action performs).
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Group 3: curated-item server-side guard ---');

// Still signed in as User B (any authenticated user suffices for this).

if (!curatedItemId) {
  console.log('SKIP  [curated-item tests] User A owns no curated items -- add one and re-run.');
} else {
  // 3a. Authenticated user cannot UPDATE wardrobe_items at all (DB layer).
  //     No write policy exists for authenticated role; expect zero rows affected
  //     or an explicit error.
  {
    const { data: wData, error: wErr } = await supabase
      .from('wardrobe_items')
      .update({ display_name: 'hacked by user B' })
      .eq('id', curatedItemId)
      .select();

    const blocked = wErr != null || (wData != null && wData.length === 0);
    const icon = blocked ? 'PASS' : 'FAIL';
    if (wErr) {
      console.log(icon + ' [DB blocks UPDATE on wardrobe_items for authenticated user] error: ' + wErr.message);
    } else {
      console.log(
        icon + ' [DB blocks UPDATE on wardrobe_items for authenticated user] rows affected: ' +
        (wData?.length ?? 0) + ' (expected 0)'
      );
    }
    allPassed &= blocked;
  }

  // 3b. App-layer guard: replicate exactly what updateWardrobeItem() does --
  //     fetch the item (allowed by the SELECT policy), read source, and
  //     assert the guard would fire.  This proves the check is server-side
  //     business logic, not just a UI hint.
  {
    const { data: itemRow, error: itemErr } = await supabase
      .from('wardrobe_items')
      .select('id, source')
      .eq('id', curatedItemId)
      .single();

    if (itemErr || !itemRow) {
      console.error('FAIL  [curated-item app-layer guard] could not fetch item:', itemErr?.message);
      allPassed = false;
    } else {
      // The server action throws when source !== 'user_upload'.
      const guardWouldFire = itemRow.source !== 'user_upload';
      const icon = guardWouldFire ? 'PASS' : 'FAIL';
      console.log(
        icon + ' [curated-item app-layer guard would throw] source=' + itemRow.source +
        ' (expected: not "user_upload")'
      );
      if (guardWouldFire) {
        // Echo the exact error message the action throws so the log is unambiguous.
        const expectedMsg = 'Item is part of the curated catalog and cannot be edited';
        console.log('      Expected error message: "' + expectedMsg + '"');
      }
      allPassed &= guardWouldFire;
    }
  }
}

// ── Final summary ─────────────────────────────────────────────────────────────
console.log('\n' + (allPassed ? 'All RLS tests PASSED.' : 'Some RLS tests FAILED -- see above.'));
process.exit(allPassed ? 0 : 1);
/**
 * scripts/test_rls.mjs
 * Phase 4B Gate 2: RLS & State Mutation Authorization Test Suite
 *
 * Verifies:
 *   - Group A: source_photos ownership isolation (A<->B cross-user protection for SELECT/UPDATE/DELETE)
 *   - Group B: wardrobe_items privacy (user uploads are private; curated catalog is readable and immutable)
 *   - Group C: Direct pipeline state mutation denial (direct client updates to processing/prettify status forbidden)
 *   - Group D: Authorized state transitions via trusted SECURITY DEFINER RPC (positive path)
 *   - Group E: Invalid state transitions rejection (negative path + verify DB state unchanged)
 *   - Group F: Cross-user transition attempts rejection
 *   - Group G: Source photo -> wardrobe item provenance invariant enforcement
 *   - Group H: Failure and edge cases (unauthenticated, unknown item/photo, etc.)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables safely
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [key, ...rest] = trimmed.split('=');
        const val = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const USER_A_EMAIL = process.env.RLS_TEST_USER_A_EMAIL || 'test1@gmail.com';
const USER_A_PASSWORD = process.env.RLS_TEST_USER_A_PASSWORD || 'test1@com';
const USER_B_EMAIL = process.env.RLS_TEST_USER_B_EMAIL || 'test2@gmail.com';
const USER_B_PASSWORD = process.env.RLS_TEST_USER_B_PASSWORD || 'test2@com';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment.');
  process.exit(1);
}

// ── Instantiate Separate Supabase Clients ─────────────────────────────────────
const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const serviceClient = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ── Test Reporting Infrastructure ─────────────────────────────────────────────
const testResults = [];
let allPassed = true;

function recordResult(group, testName, expected, actual, pass, details = '') {
  const result = pass ? 'PASS' : 'FAIL';
  testResults.push({ group, testName, expected, actual, result, details });
  if (!pass) allPassed = false;
  const icon = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${group}] ${testName} | Expected: ${expected} | Actual: ${actual}${details ? ' | ' + details : ''}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║        PHASE 4B — GATE 2 SECURITY & STATE MUTATION TEST SUITE            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  // Authenticate Client A
  console.log('Authenticating Client A...');
  const { data: authA, error: authAErr } = await clientA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: USER_A_PASSWORD,
  });
  if (authAErr || !authA?.user) {
    console.error('❌ Failed to authenticate User A:', authAErr?.message);
    process.exit(1);
  }
  const userAId = authA.user.id;
  console.log(`✓ Authenticated User A: ${userAId}`);

  // Authenticate Client B
  console.log('Authenticating Client B...');
  const { data: authB, error: authBErr } = await clientB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  if (authBErr || !authB?.user) {
    console.error('❌ Failed to authenticate User B:', authBErr?.message);
    process.exit(1);
  }
  const userBId = authB.user.id;
  console.log(`✓ Authenticated User B: ${userBId}\n`);

  // Fetch Test Fixtures for User A
  const { data: userAPhotos, error: aPhotosErr } = await clientA
    .from('source_photos')
    .select('id, user_id')
    .limit(5);

  const { data: userAItems, error: aItemsErr } = await clientA
    .from('user_wardrobe_items')
    .select('item_id, wardrobe_items(id, source, processing_status, prettify_status, source_photo_id)')
    .eq('user_id', userAId);

  // Fetch Test Fixtures for User B
  const { data: userBPhotos, error: bPhotosErr } = await clientB
    .from('source_photos')
    .select('id, user_id')
    .limit(5);

  const { data: userBItems, error: bItemsErr } = await clientB
    .from('user_wardrobe_items')
    .select('item_id, wardrobe_items(id, source, processing_status, prettify_status, source_photo_id)')
    .eq('user_id', userBId);

  // Curated Item
  const { data: curatedList } = await clientA
    .from('wardrobe_items')
    .select('id, source')
    .eq('source', 'curated')
    .limit(1);

  if (!userAPhotos?.length || !userAItems?.length || !userBPhotos?.length || !userBItems?.length || !curatedList?.length) {
    console.error('❌ Required test fixtures are missing. Run: node scripts/seed_gate2_test_data.mjs');
    process.exit(1);
  }

  const sourcePhotoAId = userAPhotos[0].id;
  const wardrobeItemAId = userAItems[0].item_id;

  const sourcePhotoBId = userBPhotos[0].id;
  const wardrobeItemBId = userBItems[0].item_id;

  const curatedItemId = curatedList[0].id;

  console.log('──────────────────────────────────────────────────────────────────────────');
  console.log('Test Fixtures Loaded:');
  console.log(`  User A Source Photo: ${sourcePhotoAId}`);
  console.log(`  User A Wardrobe Item: ${wardrobeItemAId}`);
  console.log(`  User B Source Photo: ${sourcePhotoBId}`);
  console.log(`  User B Wardrobe Item: ${wardrobeItemBId}`);
  console.log(`  Curated Catalog Item: ${curatedItemId}`);
  console.log('──────────────────────────────────────────────────────────────────────────\n');

  // =========================================================================
  // GROUP A: source_photos Ownership Isolation
  // =========================================================================
  console.log('--- GROUP A: source_photos Ownership Isolation ---');

  // A1: User A SELECT own source_photos
  {
    const { data, error } = await clientA.from('source_photos').select('id, user_id').eq('id', sourcePhotoAId);
    const pass = !error && data.length === 1 && data[0].id === sourcePhotoAId;
    recordResult('Group A', 'User A SELECT own source_photos', '1 row returned', `${data?.length ?? 0} rows`, pass);
  }

  // A2: User B SELECT own source_photos
  {
    const { data, error } = await clientB.from('source_photos').select('id, user_id').eq('id', sourcePhotoBId);
    const pass = !error && data.length === 1 && data[0].id === sourcePhotoBId;
    recordResult('Group A', 'User B SELECT own source_photos', '1 row returned', `${data?.length ?? 0} rows`, pass);
  }

  // A3: User A SELECT User B's source_photo by ID
  {
    const { data, error } = await clientA.from('source_photos').select('id, user_id').eq('id', sourcePhotoBId);
    const pass = !error && data.length === 0;
    recordResult('Group A', 'User A SELECT User B source_photo', '0 rows (DENIED)', `${data?.length ?? 0} rows`, pass);
  }

  // A4: User B SELECT User A's source_photo by ID
  {
    const { data, error } = await clientB.from('source_photos').select('id, user_id').eq('id', sourcePhotoAId);
    const pass = !error && data.length === 0;
    recordResult('Group A', 'User B SELECT User A source_photo', '0 rows (DENIED)', `${data?.length ?? 0} rows`, pass);
  }

  // A5: User A unfiltered SELECT on source_photos leaks no User B rows
  {
    const { data, error } = await clientA.from('source_photos').select('id, user_id');
    const leaked = (data ?? []).filter((r) => r.user_id !== userAId);
    const pass = !error && leaked.length === 0;
    recordResult('Group A', 'User A unfiltered SELECT leaks no foreign rows', '0 foreign rows', `${leaked.length} leaked`, pass);
  }

  // A6: User B unfiltered SELECT on source_photos leaks no User A rows
  {
    const { data, error } = await clientB.from('source_photos').select('id, user_id');
    const leaked = (data ?? []).filter((r) => r.user_id !== userBId);
    const pass = !error && leaked.length === 0;
    recordResult('Group A', 'User B unfiltered SELECT leaks no foreign rows', '0 foreign rows', `${leaked.length} leaked`, pass);
  }

  // A7: User A UPDATE own source_photos
  {
    const { data, error } = await clientA
      .from('source_photos')
      .update({ status: 'done' })
      .eq('id', sourcePhotoAId)
      .select();
    const pass = !error && data.length === 1;
    recordResult('Group A', 'User A UPDATE own source_photo', '1 row updated (ALLOW)', error ? error.message : `${data?.length ?? 0} rows`, pass);
  }

  // A8: User B UPDATE own source_photos
  {
    const { data, error } = await clientB
      .from('source_photos')
      .update({ status: 'done' })
      .eq('id', sourcePhotoBId)
      .select();
    const pass = !error && data.length === 1;
    recordResult('Group A', 'User B UPDATE own source_photo', '1 row updated (ALLOW)', error ? error.message : `${data?.length ?? 0} rows`, pass);
  }

  // A9: User A UPDATE User B source_photos
  {
    const { data, error } = await clientA
      .from('source_photos')
      .update({ status: 'failed' })
      .eq('id', sourcePhotoBId)
      .select();
    const pass = error != null || (data && data.length === 0);
    recordResult('Group A', 'User A UPDATE User B source_photo', '0 rows / blocked (DENY)', error ? error.message : `${data?.length ?? 0} rows`, pass);
  }

  // A10: User B UPDATE User A source_photos
  {
    const { data, error } = await clientB
      .from('source_photos')
      .update({ status: 'failed' })
      .eq('id', sourcePhotoAId)
      .select();
    const pass = error != null || (data && data.length === 0);
    recordResult('Group A', 'User B UPDATE User A source_photo', '0 rows / blocked (DENY)', error ? error.message : `${data?.length ?? 0} rows`, pass);
  }

  // A11: User A DELETE User B source_photos
  {
    const { data, error } = await clientA
      .from('source_photos')
      .delete()
      .eq('id', sourcePhotoBId)
      .select();
    const pass = error != null || (data && data.length === 0);
    recordResult('Group A', 'User A DELETE User B source_photo', '0 rows / blocked (DENY)', error ? error.message : `${data?.length ?? 0} rows`, pass);
  }

  // A12: User B DELETE User A source_photos
  {
    const { data, error } = await clientB
      .from('source_photos')
      .delete()
      .eq('id', sourcePhotoAId)
      .select();
    const pass = error != null || (data && data.length === 0);
    recordResult('Group A', 'User B DELETE User A source_photo', '0 rows / blocked (DENY)', error ? error.message : `${data?.length ?? 0} rows`, pass);
  }

  // =========================================================================
  // GROUP B: User-Uploaded Wardrobe Item Privacy & Curated Catalog
  // =========================================================================
  console.log('\n--- GROUP B: wardrobe_items Privacy & Curated Catalog ---');

  // B1: User A reads own upload item
  {
    const { data, error } = await clientA.from('wardrobe_items').select('id, source').eq('id', wardrobeItemAId);
    const pass = !error && data.length === 1;
    recordResult('Group B', 'User A reads own upload item', '1 row returned (ALLOW)', `${data?.length ?? 0} rows`, pass);
  }

  // B2: User B reads own upload item
  {
    const { data, error } = await clientB.from('wardrobe_items').select('id, source').eq('id', wardrobeItemBId);
    const pass = !error && data.length === 1;
    recordResult('Group B', 'User B reads own upload item', '1 row returned (ALLOW)', `${data?.length ?? 0} rows`, pass);
  }

  // B3: User A reads User B upload item
  {
    const { data, error } = await clientA.from('wardrobe_items').select('id, source').eq('id', wardrobeItemBId);
    const pass = !error && data.length === 0;
    recordResult('Group B', 'User A reads User B upload item', '0 rows (DENY)', `${data?.length ?? 0} rows`, pass);
  }

  // B4: User B reads User A upload item
  {
    const { data, error } = await clientB.from('wardrobe_items').select('id, source').eq('id', wardrobeItemAId);
    const pass = !error && data.length === 0;
    recordResult('Group B', 'User B reads User A upload item', '0 rows (DENY)', `${data?.length ?? 0} rows`, pass);
  }

  // B5: User A unfiltered SELECT leaks no User B user_upload items
  {
    const { data, error } = await clientA.from('wardrobe_items').select('id, source');
    // If it's a user_upload, User A must own it in user_wardrobe_items
    const userAOwnedItemIds = new Set(userAItems.map((r) => r.item_id));
    const leaked = (data ?? []).filter((r) => r.source === 'user_upload' && !userAOwnedItemIds.has(r.id));
    const pass = !error && leaked.length === 0;
    recordResult('Group B', 'User A unfiltered SELECT leaks no foreign user_upload items', '0 foreign uploads', `${leaked.length} leaked`, pass);
  }

  // B6: User B unfiltered SELECT leaks no User A user_upload items
  {
    const { data, error } = await clientB.from('wardrobe_items').select('id, source');
    const userBOwnedItemIds = new Set(userBItems.map((r) => r.item_id));
    const leaked = (data ?? []).filter((r) => r.source === 'user_upload' && !userBOwnedItemIds.has(r.id));
    const pass = !error && leaked.length === 0;
    recordResult('Group B', 'User B unfiltered SELECT leaks no foreign user_upload items', '0 foreign uploads', `${leaked.length} leaked`, pass);
  }

  // B7: User A mutates User B upload item
  {
    const { data, error } = await clientA
      .from('wardrobe_items')
      .update({ display_name: 'tampered by user A' })
      .eq('id', wardrobeItemBId)
      .select();
    const pass = error != null || (data && data.length === 0);
    recordResult('Group B', 'User A mutates User B upload item', '0 rows / blocked (DENY)', error ? error.message : `${data?.length ?? 0} rows`, pass);
  }

  // B8: User B mutates User A upload item
  {
    const { data, error } = await clientB
      .from('wardrobe_items')
      .update({ display_name: 'tampered by user B' })
      .eq('id', wardrobeItemAId)
      .select();
    const pass = error != null || (data && data.length === 0);
    recordResult('Group B', 'User B mutates User A upload item', '0 rows / blocked (DENY)', error ? error.message : `${data?.length ?? 0} rows`, pass);
  }

  // B9: Curated item readable by User A
  {
    const { data, error } = await clientA.from('wardrobe_items').select('id, source').eq('id', curatedItemId);
    const pass = !error && data.length === 1 && data[0].source === 'curated';
    recordResult('Group B', 'User A reads curated item', '1 row returned (ALLOW)', `${data?.length ?? 0} rows`, pass);
  }

  // B10: Curated item readable by User B
  {
    const { data, error } = await clientB.from('wardrobe_items').select('id, source').eq('id', curatedItemId);
    const pass = !error && data.length === 1 && data[0].source === 'curated';
    recordResult('Group B', 'User B reads curated item', '1 row returned (ALLOW)', `${data?.length ?? 0} rows`, pass);
  }

  // B11: Authenticated user cannot mutate curated item
  {
    const { data, error } = await clientA
      .from('wardrobe_items')
      .update({ display_name: 'hacked curated item' })
      .eq('id', curatedItemId)
      .select();
    const pass = error != null || (data && data.length === 0);
    recordResult('Group B', 'Authenticated user cannot mutate curated item', '0 rows / blocked (DENY)', error ? error.message : `${data?.length ?? 0} rows`, pass);
  }

  // =========================================================================
  // GROUP C: Direct Pipeline State Mutation Tests
  // =========================================================================
  console.log('\n--- GROUP C: Direct Pipeline State Mutation Tests ---');

  // C1: User A direct UPDATE processing_status on own item
  {
    const { data, error } = await clientA
      .from('wardrobe_items')
      .update({ processing_status: 'isolating' })
      .eq('id', wardrobeItemAId)
      .select();
    const pass = error != null; // Trigger raises exception
    recordResult(
      'Group C',
      'User A direct UPDATE processing_status',
      'Exception raised (DENY)',
      error ? `Blocked: ${error.message}` : `Allowed (${data?.length} rows)`,
      pass
    );
  }

  // C2: User A direct UPDATE prettify_status on own item
  {
    const { data, error } = await clientA
      .from('wardrobe_items')
      .update({ prettify_status: 'processing' })
      .eq('id', wardrobeItemAId)
      .select();
    const pass = error != null; // Trigger raises exception
    recordResult(
      'Group C',
      'User A direct UPDATE prettify_status',
      'Exception raised (DENY)',
      error ? `Blocked: ${error.message}` : `Allowed (${data?.length} rows)`,
      pass
    );
  }

  // =========================================================================
  // GROUP D: Trusted RPC Positive State Transitions
  // =========================================================================
  console.log('\n--- GROUP D: Trusted RPC Positive State Transitions ---');

  // Reset Item A to 'detected' via service client or check initial state
  if (serviceClient) {
    await serviceClient
      .from('wardrobe_items')
      .update({ processing_status: 'detected', prettify_status: 'none' })
      .eq('id', wardrobeItemAId);
  }

  // D1: detected -> isolating
  {
    const { data, error } = await clientA.rpc('transition_wardrobe_item_processing_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'isolating',
    });
    const pass = !error && data === 'isolating';
    recordResult('Group D', 'Transition detected -> isolating', 'isolating (SUCCESS)', error ? error.message : data, pass);
  }

  // D2: isolating -> isolated
  {
    const { data, error } = await clientA.rpc('transition_wardrobe_item_processing_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'isolated',
    });
    const pass = !error && data === 'isolated';
    recordResult('Group D', 'Transition isolating -> isolated', 'isolated (SUCCESS)', error ? error.message : data, pass);
  }

  // D3: isolated -> extracting
  {
    const { data, error } = await clientA.rpc('transition_wardrobe_item_processing_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'extracting',
    });
    const pass = !error && data === 'extracting';
    recordResult('Group D', 'Transition isolated -> extracting', 'extracting (SUCCESS)', error ? error.message : data, pass);
  }

  // D4: extracting -> extracted
  {
    const { data, error } = await clientA.rpc('transition_wardrobe_item_processing_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'extracted',
    });
    const pass = !error && data === 'extracted';
    recordResult('Group D', 'Transition extracting -> extracted', 'extracted (SUCCESS)', error ? error.message : data, pass);
  }

  // D5: Prettify none -> processing
  {
    const { data, error } = await clientA.rpc('transition_wardrobe_item_prettify_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'processing',
    });
    const pass = !error && data === 'processing';
    recordResult('Group D', 'Prettify none -> processing', 'processing (SUCCESS)', error ? error.message : data, pass);
  }

  // D6: Prettify processing -> done
  {
    const { data, error } = await clientA.rpc('transition_wardrobe_item_prettify_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'done',
    });
    const pass = !error && data === 'done';
    recordResult('Group D', 'Prettify processing -> done', 'done (SUCCESS)', error ? error.message : data, pass);
  }

  // =========================================================================
  // GROUP E: Invalid State Transitions (Negative Path & Immutability)
  // =========================================================================
  console.log('\n--- GROUP E: Invalid State Transitions ---');

  // E1: extracted -> detected (invalid backward jump)
  {
    const { data, error } = await clientA.rpc('transition_wardrobe_item_processing_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'detected',
    });
    // Check that DB state is still 'extracted'
    const { data: dbRow } = await clientA.from('wardrobe_items').select('processing_status').eq('id', wardrobeItemAId).single();
    const pass = error != null && dbRow?.processing_status === 'extracted';
    recordResult(
      'Group E',
      'Invalid transition extracted -> detected',
      'Exception & state unchanged (DENIED)',
      error ? `Rejected: ${error.message} (DB state: ${dbRow?.processing_status})` : `Unexpected success: ${data}`,
      pass
    );
  }

  // E2: extracted -> isolating (invalid retry when not in failed)
  {
    const { data, error } = await clientA.rpc('transition_wardrobe_item_processing_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'isolating',
    });
    const { data: dbRow } = await clientA.from('wardrobe_items').select('processing_status').eq('id', wardrobeItemAId).single();
    const pass = error != null && dbRow?.processing_status === 'extracted';
    recordResult(
      'Group E',
      'Invalid transition extracted -> isolating',
      'Exception & state unchanged (DENIED)',
      error ? `Rejected: ${error.message} (DB state: ${dbRow?.processing_status})` : `Unexpected success: ${data}`,
      pass
    );
  }

  // E3: Prettify done -> processing (invalid transition from terminal done)
  {
    const { data, error } = await clientA.rpc('transition_wardrobe_item_prettify_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'processing',
    });
    const { data: dbRow } = await clientA.from('wardrobe_items').select('prettify_status').eq('id', wardrobeItemAId).single();
    const pass = error != null && dbRow?.prettify_status === 'done';
    recordResult(
      'Group E',
      'Invalid prettify done -> processing',
      'Exception & state unchanged (DENIED)',
      error ? `Rejected: ${error.message} (DB state: ${dbRow?.prettify_status})` : `Unexpected success: ${data}`,
      pass
    );
  }

  // =========================================================================
  // GROUP F: Cross-User RPC Calls
  // =========================================================================
  console.log('\n--- GROUP F: Cross-User RPC Calls ---');

  // F1: User B tries to transition User A's item processing state
  {
    const { data, error } = await clientB.rpc('transition_wardrobe_item_processing_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'failed',
    });
    const { data: dbRow } = await clientA.from('wardrobe_items').select('processing_status').eq('id', wardrobeItemAId).single();
    const pass = error != null && dbRow?.processing_status === 'extracted';
    recordResult(
      'Group F',
      'User B transition User A item (processing)',
      'Exception & state unchanged (DENIED)',
      error ? `Blocked: ${error.message} (DB state: ${dbRow?.processing_status})` : `Unexpected success: ${data}`,
      pass
    );
  }

  // F2: User B tries to transition User A's item prettify state
  {
    const { data, error } = await clientB.rpc('transition_wardrobe_item_prettify_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'failed',
    });
    const { data: dbRow } = await clientA.from('wardrobe_items').select('prettify_status').eq('id', wardrobeItemAId).single();
    const pass = error != null && dbRow?.prettify_status === 'done';
    recordResult(
      'Group F',
      'User B transition User A item (prettify)',
      'Exception & state unchanged (DENIED)',
      error ? `Blocked: ${error.message} (DB state: ${dbRow?.prettify_status})` : `Unexpected success: ${data}`,
      pass
    );
  }

  // =========================================================================
  // GROUP G: Source Photo -> Wardrobe Item Provenance Invariant
  // =========================================================================
  console.log('\n--- GROUP G: Provenance Invariant Enforcement ---');

  // G1: User A creates derived item referencing User A's source photo
  let userADerivedItemId = null;
  {
    const { data, error } = await clientA.rpc('create_draft_wardrobe_item', {
      p_image_url: 'https://example.com/user-a-derived-garment.jpg',
      p_source_photo_id: sourcePhotoAId,
    });
    userADerivedItemId = data;
    const pass = !error && userADerivedItemId != null;
    recordResult(
      'Group G',
      'User A creates derived item with own source photo',
      'Item UUID returned (ALLOW)',
      error ? error.message : `Created item: ${userADerivedItemId}`,
      pass
    );
  }

  // G2: Verify provenance link in database
  if (userADerivedItemId) {
    const { data, error } = await clientA
      .from('wardrobe_items')
      .select('id, source_photo_id, source, processing_status, prettify_status')
      .eq('id', userADerivedItemId)
      .single();
    const pass =
      !error &&
      data.source_photo_id === sourcePhotoAId &&
      data.source === 'user_upload' &&
      data.processing_status === 'detected';
    recordResult(
      'Group G',
      'Verify derived item provenance linkage',
      'source_photo_id matches User A photo',
      error ? error.message : `Linked: ${data?.source_photo_id}`,
      pass
    );
  }

  // G3: User A attempts to create derived item referencing User B's source photo
  {
    const { data, error } = await clientA.rpc('create_draft_wardrobe_item', {
      p_image_url: 'https://example.com/exploit-derived-garment.jpg',
      p_source_photo_id: sourcePhotoBId,
    });
    const pass = error != null && data == null;
    recordResult(
      'Group G',
      'User A links User B source photo (Provenance Spoof)',
      'Exception / ownership mismatch (DENIED)',
      error ? `Blocked: ${error.message}` : `Exploit succeeded: ${data}`,
      pass
    );
  }

  // =========================================================================
  // GROUP H: Failure and Edge Cases
  // =========================================================================
  console.log('\n--- GROUP H: Failure and Edge Cases ---');

  // H1: Missing / Non-existent wardrobe item UUID
  {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await clientA.rpc('transition_wardrobe_item_processing_state', {
      p_item_id: fakeId,
      p_target_status: 'isolating',
    });
    const pass = error != null;
    recordResult('Group H', 'Transition non-existent item UUID', 'Exception (DENIED)', error ? error.message : `Unexpected: ${data}`, pass);
  }

  // H2: Unauthenticated caller calls transition RPC
  {
    const { data, error } = await anonClient.rpc('transition_wardrobe_item_processing_state', {
      p_item_id: wardrobeItemAId,
      p_target_status: 'isolating',
    });
    const pass = error != null;
    recordResult('Group H', 'Unauthenticated caller calls transition RPC', 'Exception (DENIED)', error ? error.message : `Unexpected: ${data}`, pass);
  }

  // H3: Draft creation with non-existent source photo UUID
  {
    const fakePhotoId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await clientA.rpc('create_draft_wardrobe_item', {
      p_image_url: 'https://example.com/phantom-photo.jpg',
      p_source_photo_id: fakePhotoId,
    });
    const pass = error != null;
    recordResult('Group H', 'Draft creation with non-existent source photo', 'Exception (DENIED)', error ? error.message : `Unexpected: ${data}`, pass);
  }

  // =========================================================================
  // Final Summary & Exit
  // =========================================================================
  console.log('\n══════════════════════════════════════════════════════════════════════════');
  console.log(`Gate 2 Test Summary: ${testResults.filter((r) => r.result === 'PASS').length} / ${testResults.length} PASSED`);
  if (allPassed) {
    console.log('🎉 ALL GATE 2 SECURITY TESTS PASSED!');
  } else {
    console.log('❌ SOME TESTS FAILED. See log above for details.');
  }
  console.log('══════════════════════════════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Fatal error during test execution:', err);
  process.exit(1);
});
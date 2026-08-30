/**
 * scripts/seed_gate2_test_data.mjs
 * 
 * Seeds test data for Gate 2 RLS isolation tests.
 * Must be run AFTER test accounts are created.
 * 
 * This script uses the service role to bypass RLS and populate:
 *   - source_photos (User A and User B)
 *   - wardrobe_items linked to source photos
 *   - wardrobe user associations
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Use service role (bypass RLS) for seeding
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// User IDs from test account setup
const USER_A_ID = 'a2979897-5d2c-4963-863b-1508bba38359';
const USER_B_ID = 'ac432fa7-7140-4b5a-924e-a7d7119944c9';

async function seedTestData() {
  console.log('🌱 Seeding Gate 2 test data...\n');

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Create source_photos for User A
    // ─────────────────────────────────────────────────────────────────────────
    console.log('📸 Creating source_photos for User A...');
    const { data: sourcePhotoA, error: sourcePhotoAErr } = await supabase
      .from('source_photos')
      .insert({
        user_id: USER_A_ID,
        image_url: 'https://example.com/user-a-source-photo.jpg',
        status: 'done',
        idempotency_key: 'test-a-001',
        file_hash: 'abc123hash'
      })
      .select('id')
      .single();

    if (sourcePhotoAErr) {
      console.error('❌ Error creating source_photo for User A:', sourcePhotoAErr.message);
      process.exit(1);
    }
    console.log(`✅ User A source_photo created: ${sourcePhotoA.id}\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Create source_photos for User B
    // ─────────────────────────────────────────────────────────────────────────
    console.log('📸 Creating source_photos for User B...');
    const { data: sourcePhotoB, error: sourcPhotoBErr } = await supabase
      .from('source_photos')
      .insert({
        user_id: USER_B_ID,
        image_url: 'https://example.com/user-b-source-photo.jpg',
        status: 'done',
        idempotency_key: 'test-b-001',
        file_hash: 'def456hash'
      })
      .select('id')
      .single();

    if (sourcPhotoBErr) {
      console.error('❌ Error creating source_photo for User B:', sourcPhotoBErr.message);
      process.exit(1);
    }
    console.log(`✅ User B source_photo created: ${sourcePhotoB.id}\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Create wardrobe_items for User A (linked to User A's source photo)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('👕 Creating wardrobe_items for User A...');
    const { data: itemA, error: itemAErr } = await supabase
      .from('wardrobe_items')
      .insert({
        source_photo_id: sourcePhotoA.id,
        display_name: 'Test Shirt - User A',
        source: 'user_upload',
        category: 'shirt',
        color: 'blue',
        pattern: 'solid',
        material: 'cotton',
        processing_status: 'extracted',
        prettify_status: 'none',
        crop_box: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
      })
      .select('id')
      .single();

    if (itemAErr) {
      console.error('❌ Error creating wardrobe_item for User A:', itemAErr.message);
      process.exit(1);
    }
    console.log(`✅ User A wardrobe_item created: ${itemA.id}\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Create user_wardrobe_items join for User A
    // ─────────────────────────────────────────────────────────────────────────
    console.log('🔗 Creating user_wardrobe_items join for User A...');
    const { data: joinA, error: joinAErr } = await supabase
      .from('user_wardrobe_items')
      .insert({
        user_id: USER_A_ID,
        item_id: itemA.id
      })
      .select('*')
      .single();

    if (joinAErr) {
      console.error('❌ Error creating join for User A:', joinAErr.message);
      process.exit(1);
    }
    console.log(`✅ User A user_wardrobe_items join created\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Create wardrobe_items for User B (linked to User B's source photo)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('👕 Creating wardrobe_items for User B...');
    const { data: itemB, error: itemBErr } = await supabase
      .from('wardrobe_items')
      .insert({
        source_photo_id: sourcePhotoB.id,
        display_name: 'Test Pants - User B',
        source: 'user_upload',
        category: 'pants',
        color: 'black',
        pattern: 'solid',
        material: 'denim',
        processing_status: 'extracted',
        prettify_status: 'none',
        crop_box: { x: 0.15, y: 0.25, width: 0.25, height: 0.5 }
      })
      .select('id')
      .single();

    if (itemBErr) {
      console.error('❌ Error creating wardrobe_item for User B:', itemBErr.message);
      process.exit(1);
    }
    console.log(`✅ User B wardrobe_item created: ${itemB.id}\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Create user_wardrobe_items join for User B
    // ─────────────────────────────────────────────────────────────────────────
    console.log('🔗 Creating user_wardrobe_items join for User B...');
    const { data: joinB, error: joinBErr } = await supabase
      .from('user_wardrobe_items')
      .insert({
        user_id: USER_B_ID,
        item_id: itemB.id
      })
      .select('*')
      .single();

    if (joinBErr) {
      console.error('❌ Error creating join for User B:', joinBErr.message);
      process.exit(1);
    }
    console.log(`✅ User B user_wardrobe_items join created\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Summary
    // ─────────────────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════');
    console.log('✅ Gate 2 test data seeded successfully!\n');
    console.log('Test Data Summary:');
    console.log(`  User A (${USER_A_ID}):`);
    console.log(`    - source_photo: ${sourcePhotoA.id}`);
    console.log(`    - wardrobe_item: ${itemA.id}`);
    console.log(`  User B (${USER_B_ID}):`);
    console.log(`    - source_photo: ${sourcePhotoB.id}`);
    console.log(`    - wardrobe_item: ${itemB.id}`);
    console.log('\nReady to run: node scripts/test_rls.mjs');
    console.log('════════════════════════════════════════════════════════');

    process.exit(0);
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

seedTestData();

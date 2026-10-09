// supabase/scripts/importExercises.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
const fs = require('fs');

const { Pool } = require('pg');

// 1. Configure your Supabase/Postgres connection for Session Pooler
let pool;

if (process.env.SUPABASE_CONNECTION_STRING) {
  // Use connection string if provided (recommended)
  let connectionString = process.env.SUPABASE_CONNECTION_STRING.trim();
  
  // Remove variable name if accidentally included
  if (connectionString.startsWith('SUPABASE_CONNECTION_STRING=')) {
    connectionString = connectionString.replace(/^SUPABASE_CONNECTION_STRING=/, '');
  }
  
  // Validate it starts with postgresql://
  if (!connectionString.startsWith('postgresql://')) {
    console.error('❌ Invalid connection string format');
    console.error('   Should start with: postgresql://');
    console.error('   Got:', connectionString.substring(0, 50));
    process.exit(1);
  }
  
  pool = new Pool({
    connectionString: connectionString,
  });
  console.log('✅ Using session pooler connection string');
} else {
  // Use session pooler with individual parameters
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  
  if (!dbPassword) {
    console.error('❌ Missing SUPABASE_DB_PASSWORD or SUPABASE_CONNECTION_STRING in .env.local');
    console.error('   Recommended: Add SUPABASE_CONNECTION_STRING=postgresql://postgres.xdkembwieusuvtogpkpu:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres');
    process.exit(1);
  }

  pool = new Pool({
    host: 'aws-1-us-east-1.pooler.supabase.com', // Session pooler host (IPv4)
    port: 5432, // Session pooler port
    database: 'postgres',
    user: 'postgres.xdkembwieusuvtogpkpu', // Format: postgres.[project-ref] for session pooler
    password: dbPassword.trim(),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  console.log('✅ Using session pooler connection (individual parameters)');
}

const EXERCISE_DB_URL = 'https://www.ascendapi.com/api/v1/exercises/search';

// Ascend API seems to default to a small page size (often 10). We'll page until we hit the target.
const PAGE_SIZE = 100;
const TARGET_COUNT = 1000;
const MAX_PAGES = 200; // safety guard

// Rate limiting / resilience
const REQUEST_DELAY_MS = 400; // small delay between pages to reduce 429s
const MAX_RETRIES = 7;
const MAX_BACKOFF_MS = 30_000;

// Resume support
const PROGRESS_FILE = path.resolve(__dirname, './importexercises.progress.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readProgress() {
  try {
    if (!fs.existsSync(PROGRESS_FILE)) return { lastCompletedPage: 0 };
    const raw = fs.readFileSync(PROGRESS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      lastCompletedPage: Number(parsed?.lastCompletedPage || 0),
    };
  } catch {
    return { lastCompletedPage: 0 };
  }
}

function writeProgress(lastCompletedPage) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ lastCompletedPage, updatedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
}

async function fetchJsonWithRetry(url, page) {
  let attempt = 0;
  let backoff = 1000;

  while (true) {
    attempt++;

    const res = await fetch(url);

    // Handle rate limit explicitly
    if (res.status === 429) {
      if (attempt > MAX_RETRIES) {
        throw new Error(`Rate limited (429) too many times on page ${page}.`);
      }

      const retryAfterHeader = res.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      const waitMs = Number.isFinite(retryAfterSeconds)
        ? Math.min(MAX_BACKOFF_MS, Math.max(1000, retryAfterSeconds * 1000))
        : Math.min(MAX_BACKOFF_MS, backoff);

      console.log(`⚠️  429 rate limit on page ${page}. Waiting ${Math.round(waitMs / 1000)}s then retrying (attempt ${attempt}/${MAX_RETRIES})...`);
      await sleep(waitMs);
      backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
      continue;
    }

    if (!res.ok) {
      // Log the error response body for debugging
      let errorBody = '';
      try {
        errorBody = await res.text();
        const errorJson = JSON.parse(errorBody);
        console.error(`❌ API Error (${res.status}) on page ${page}:`, JSON.stringify(errorJson, null, 2));
      } catch {
        console.error(`❌ API Error (${res.status}) on page ${page}:`, errorBody.substring(0, 200));
      }
      
      // transient server errors
      if ([500, 502, 503, 504].includes(res.status) && attempt <= MAX_RETRIES) {
        console.log(`⚠️  ${res.status} on page ${page}. Retrying in ${Math.round(backoff / 1000)}s (attempt ${attempt}/${MAX_RETRIES})...`);
        await sleep(backoff);
        backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
        continue;
      }
      throw new Error(`Failed to fetch exercises (page ${page}): ${res.status}`);
    }

    return await res.json();
  }
}

// Helper to insert exercise into database
async function insertExercise(pool, ex) {
  const {
    name,
  } = ex;

  try {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      console.log('⚠️  Skipping empty name');
      return false;
    }

    const result = await pool.query(
      `
      INSERT INTO exercise_library (
        id,
        name,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        NOW()
      )
      ON CONFLICT (name)
      DO NOTHING
      RETURNING id
      `,
      [
        trimmedName,
      ]
    );

    // If insert happened, RETURNING will yield a row; if it conflicted, rows will be empty.
    const didInsert = result.rows.length > 0;
    if (didInsert) {
      console.log(`✅ Inserted: ${trimmedName}`);
    } else {
      console.log(`⏭️  Skipped (duplicate): ${trimmedName}`);
    }
    return didInsert;
  } catch (error) {
    console.error('❌ Insert error:', error.message, 'Exercise:', name);
    // Check if it's a constraint error
    if (error.code === '23505') {
      console.error('   (Unique constraint violation - name might already exist)');
    } else if (error.code === '42P01') {
      console.error('   (Table does not exist)');
    } else if (error.message.includes('conflict')) {
      console.error('   (Conflict clause issue - check if unique constraint exists on name)');
    }
    return false;
  }
}

(async () => {
  try {
    // Test connection before starting import
    console.log('Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    console.log('   Server time:', testResult.rows[0].now);
    console.log('');

    let insertedCount = 0;
    let errorCount = 0;

    const progress = readProgress();
    let startPage = Math.max(1, (progress.lastCompletedPage || 0) + 1);

    console.log(`Resume: lastCompletedPage=${progress.lastCompletedPage || 0} → starting at page ${startPage}`);
    console.log(`(Progress file: ${PROGRESS_FILE})`);
    console.log('');

    console.log(`Fetching exercises from ExerciseDB (target inserted: ${TARGET_COUNT}, pageSize: ${PAGE_SIZE})…`);
    console.log('');

    // Track seen exercise names to detect if pagination is broken
    const seenNames = new Set();
    let consecutiveDuplicatePages = 0;
    const MAX_CONSECUTIVE_DUPLICATES = 3;

    for (let page = startPage; page <= MAX_PAGES; page++) {
      if (insertedCount >= TARGET_COUNT) break;

      // Use the search endpoint with offset/limit pagination (matching curl example)
      const url = new URL(EXERCISE_DB_URL);
      const offset = (page - 1) * PAGE_SIZE;
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('limit', String(PAGE_SIZE));
      url.searchParams.set('q', ''); // Empty query to get all exercises
      url.searchParams.set('threshold', '0.3'); // Match threshold
      
      console.log(`   Requesting: ${url.toString()}`);

      const json = await fetchJsonWithRetry(url.toString(), page);
      if (!json.success || !Array.isArray(json.data)) {
        // Log the response to debug
        console.log(`⚠️  Unexpected response structure on page ${page}:`, JSON.stringify(json).substring(0, 200));
        throw new Error(`Invalid response from ExerciseDB (page ${page})`);
      }

      const pageData = json.data;
      console.log(`Page ${page}: fetched ${pageData.length} exercises`);
      
      // Log pagination metadata if available
      if (json.pagination || json.meta || json.total) {
        console.log(`   Pagination info:`, JSON.stringify({ pagination: json.pagination, meta: json.meta, total: json.total }).substring(0, 150));
      }

      if (pageData.length === 0) {
        console.log('No more exercises returned; stopping pagination.');
        break;
      }

      // Check for duplicate pages (same exercises appearing again)
      let newNamesThisPage = 0;
      let duplicateNamesThisPage = 0;
      for (const ex of pageData) {
        const name = (ex.name || '').trim();
        if (seenNames.has(name)) {
          duplicateNamesThisPage++;
        } else {
          seenNames.add(name);
          newNamesThisPage++;
        }
      }

      if (newNamesThisPage === 0 && pageData.length > 0) {
        consecutiveDuplicatePages++;
        console.log(`⚠️  Page ${page} contains only duplicates (${duplicateNamesThisPage}/${pageData.length})`);
        console.log(`   This is consecutive duplicate page #${consecutiveDuplicatePages}`);
        
        if (consecutiveDuplicatePages >= MAX_CONSECUTIVE_DUPLICATES) {
          console.log(`❌ Stopping: ${MAX_CONSECUTIVE_DUPLICATES} consecutive pages with only duplicates.`);
          console.log(`   The API pagination may not be working correctly, or we've reached the end.`);
          console.log(`   Total unique exercises seen: ${seenNames.size}`);
          break;
        }
      } else {
        consecutiveDuplicatePages = 0; // Reset counter if we got new data
      }

      let pageInserted = 0;
      let pageSkipped = 0;
      for (const ex of pageData) {
        if (insertedCount >= TARGET_COUNT) break;
        try {
          const didInsert = await insertExercise(pool, ex);
          if (didInsert) {
            insertedCount++;
            pageInserted++;
          } else {
            pageSkipped++;
          }
        } catch (err) {
          errorCount++;
          console.error(`Error inserting ${ex?.name || 'unknown'}:`, err.message || err);
        }
      }
      
      console.log(`   Page ${page} summary: ${pageInserted} inserted, ${pageSkipped} skipped (duplicates)`);
      console.log(`   Unique names seen so far: ${seenNames.size}`);

      // Mark page complete so reruns resume from next page.
      writeProgress(page);

      // Be kind to the API to avoid 429s.
      await sleep(REQUEST_DELAY_MS);

      // If we got fewer than the requested page size, assume last page.
      if (pageData.length < PAGE_SIZE) {
        console.log('Last page detected (returned < pageSize); stopping pagination.');
        break;
      }
    }

    console.log('');
    console.log('--- Import Summary ---');
    console.log(`✅ Newly inserted: ${insertedCount} exercises`);
    if (errorCount > 0) {
      console.log(`❌ Failed to import: ${errorCount} exercises`);
    }
    console.log('----------------------');

    // Show the actual current table count for sanity.
    try {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM exercise_library');
      console.log(`Current exercise_library rows: ${rows?.[0]?.count ?? 'unknown'}`);
    } catch (e) {
      // ignore
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Error importing exercises:', err.message || err);
    await pool.end();
    process.exit(1);
  }
})();

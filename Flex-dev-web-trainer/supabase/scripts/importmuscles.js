// supabase/scripts/importMuscles.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

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

const WGER_MUSCLES_URL = 'https://wger.de/api/v2/muscle/';

async function fetchAllMuscles() {
  let results = [];
  let url = WGER_MUSCLES_URL;

  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed fetch: ${res.status}`);

    const data = await res.json();
    results.push(...data.results);
    url = data.next;
  }

  return results;
}

(async () => {
  try {
    console.log('Fetching muscles from WGER...');
    const muscles = await fetchAllMuscles();
    console.log(`Found ${muscles.length} muscles`);

    for (const m of muscles) {
      await pool.query(
        `
        INSERT INTO muscles (name, wger_id)
        VALUES ($1, $2)
        ON CONFLICT (wger_id)
        DO UPDATE SET
          name = EXCLUDED.name
        `,
        [
          m.name,
          m.id
        ]
      );
    }

    console.log('✅ Muscles import complete');
    await pool.end();
  } catch (err) {
    console.error('❌ Error importing muscles:', err);
    await pool.end();
    process.exit(1);
  }
})();

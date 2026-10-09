// supabase/scripts/importEquipment.js

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

const EQUIPMENT_API = 'https://www.ascendapi.com/api/v1/equipments';

(async () => {
  try {
    // Test connection before starting import
    console.log('Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    console.log('   Server time:', testResult.rows[0].now);
    console.log('');

    console.log('Fetching equipment from ExerciseDB…');
    const res = await fetch(EQUIPMENT_API);
    if (!res.ok) {
      throw new Error(`Failed to fetch equipment: ${res.status}`);
    }

    const json = await res.json();

    if (!json.success || !Array.isArray(json.data)) {
      throw new Error('Unexpected API response format');
    }

    console.log(`Found ${json.data.length} equipment items`);

    for (const eq of json.data) {
      const equipmentName = eq.name.trim().toLowerCase();
      
      await pool.query(
        `
        INSERT INTO equipment (name)
        VALUES ($1)
        ON CONFLICT (name)
        DO UPDATE SET
          name = EXCLUDED.name
        `,
        [equipmentName]
      );
    }

    console.log('✅ Equipment import complete');
    await pool.end();
  } catch (err) {
    console.error('❌ Error importing equipment:', err.message || err);
    await pool.end();
    process.exit(1);
  }
})();

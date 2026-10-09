// importNutrition.js


const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
 // Connection options for Session Pooler:
 // Option 1 (Easiest): Use SUPABASE_CONNECTION_STRING from Settings > Database > Connection pooling
 //   Format: postgresql://postgres.xdkembwieusuvtogpkpu:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
 // Option 2: Use SUPABASE_DB_PASSWORD with session pooler parameters
 require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') }); // <-

// 1. Configure your Supabase/Postgres connection for Session Pooler
let pool;

// Debug: Check what env vars are available
console.log('Environment check:');
console.log('   SUPABASE_CONNECTION_STRING:', process.env.SUPABASE_CONNECTION_STRING ? 'SET (' + process.env.SUPABASE_CONNECTION_STRING.substring(0, 30) + '...)' : 'NOT SET');
console.log('   SUPABASE_DB_PASSWORD:', process.env.SUPABASE_DB_PASSWORD ? 'SET (' + process.env.SUPABASE_DB_PASSWORD.length + ' chars)' : 'NOT SET');
console.log('');

if (process.env.SUPABASE_CONNECTION_STRING) {
  // Use connection string if provided
  // Note: If password has special characters, make sure they're URL-encoded in the connection string
  let connectionString = process.env.SUPABASE_CONNECTION_STRING.trim();
  
  // Remove variable name if accidentally included (e.g., "SUPABASE_CONNECTION_STRING=postgresql://...")
  if (connectionString.startsWith('SUPABASE_CONNECTION_STRING=')) {
    connectionString = connectionString.replace(/^SUPABASE_CONNECTION_STRING=/, '');
    console.log('   ⚠️  Removed variable name prefix from connection string');
  }
  
  // Validate it starts with postgresql://
  if (!connectionString.startsWith('postgresql://')) {
    console.error('❌ Invalid connection string format');
    console.error('   Should start with: postgresql://');
    console.error('   Got:', connectionString.substring(0, 50));
    console.error('   Full value:', connectionString);
    process.exit(1);
  }
  
  pool = new Pool({
    connectionString: connectionString,
  });
  console.log('✅ Using session pooler connection string');
  console.log('   Host:', connectionString.match(/@([^:]+):/)?.[1] || 'unknown');
  console.log('   User:', connectionString.match(/\/\/([^:]+):/)?.[1] || 'unknown');
} else {
  // Use session pooler with individual parameters
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  
  if (!dbPassword) {
    console.error('❌ Missing SUPABASE_DB_PASSWORD or SUPABASE_CONNECTION_STRING in .env.local');
    console.error('   Option 1 (Recommended): Add SUPABASE_CONNECTION_STRING=postgresql://postgres.xdkembwieusuvtogpkpu:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres');
    console.error('   Option 2: Add SUPABASE_DB_PASSWORD=your_password');
    console.error('');
    console.error('   Note: If password has special characters (!@#$%^&*), URL-encode them in the connection string');
    console.error('   Example: ! becomes %21, @ becomes %40, etc.');
    process.exit(1);
  }

  const trimmedPassword = dbPassword.trim();
  
  pool = new Pool({
    host: 'aws-1-us-east-1.pooler.supabase.com', // Session pooler host (IPv4)
    port: 5432, // Session pooler port
    database: 'postgres',
    user: 'postgres.xdkembwieusuvtogpkpu', // Format: postgres.[project-ref] for session pooler
    password: trimmedPassword,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  console.log('✅ Using session pooler connection (individual parameters)');
  console.log('   User: postgres.xdkembwieusuvtogpkpu');
  console.log('   Host: aws-1-us-east-1.pooler.supabase.com:5432');
  console.log('   Password length:', trimmedPassword.length, 'characters');
}

// 2. Read USDA JSON safely using __dirname
const dataPath = path.join(__dirname, 'FoodData_Central_foundation_food_json_2025-12-18.json');

let data;
try {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log('Found', data.FoundationFoods.length, 'foods');
} catch (err) {
  console.error('❌ Failed to read JSON:', err);
  process.exit(1); // stop script if JSON cannot be read
}

const foodsArray = data.FoundationFoods;

// Helper function to retry a query with exponential backoff
async function retryQuery(queryFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`   Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
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
    
    console.log('Starting import...');
    let count = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const food of foodsArray) {
      count++;
      if (count % 50 === 0) {
        console.log(`Processed ${count}/${foodsArray.length} foods (${successCount} successful, ${errorCount} errors)`);
      }

      try {
        // --- 3. Insert food ---
        const foodResult = await retryQuery(() =>
          pool.query(
            `INSERT INTO foods (fdc_id, description, food_class, data_type, brand_name, category)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (fdc_id) DO UPDATE SET description = EXCLUDED.description
             RETURNING id`,
            [
              food.fdcId,
              food.description,
              food.foodClass || null,
              food.dataType || null,
              food.brandOwner || null,
              food.category || null,
            ]
          )
        );

        const food_id = foodResult.rows[0].id;

        // --- 4. Insert nutrients ---
        if (food.foodNutrients && food.foodNutrients.length > 0) {
          for (const fn of food.foodNutrients) {
            try {
              const nutrient = fn.nutrient;

              // Insert nutrient if not exists
              const nutrientResult = await retryQuery(() =>
                pool.query(
                  `INSERT INTO nutrients (nutrient_id, name, unit_name, rank)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (nutrient_id) DO NOTHING
                   RETURNING id`,
                  [nutrient.id, nutrient.name, nutrient.unitName, nutrient.rank || null]
                )
              );

              let nutrient_id;
              if (nutrientResult.rows.length > 0) {
                nutrient_id = nutrientResult.rows[0].id;
              } else {
                // If already exists, fetch it
                const existing = await retryQuery(() =>
                  pool.query(
                    `SELECT id FROM nutrients WHERE nutrient_id = $1`,
                    [nutrient.id]
                  )
                );
                nutrient_id = existing.rows[0].id;
              }

              // --- 5. Insert food_nutrients ---
              await retryQuery(() =>
                pool.query(
                  `INSERT INTO food_nutrients (food_id, nutrient_id, amount, measurement_type)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (food_id, nutrient_id) DO UPDATE SET amount = EXCLUDED.amount`,
                  [food_id, nutrient_id, fn.amount || 0, fn.measurementType || null]
                )
              );
            } catch (nutrientErr) {
              console.error(`   Error processing nutrient for food ${food.fdcId}:`, nutrientErr.message);
              // Continue with next nutrient
            }
          }
        }

        // --- 6. Optional: insert default serving (100g) ---
        await retryQuery(() =>
          pool.query(
            `INSERT INTO food_servings (food_id, description, serving_size, unit_name)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [food_id, '100 g', 100, 'g']
          )
        );

        successCount++;
      } catch (foodErr) {
        errorCount++;
        console.error(`❌ Error processing food ${food.fdcId} (${food.description}):`, foodErr.message);
        // Continue with next food
      }
    }

    console.log('');
    console.log('✅ USDA Foundation Foods import complete!');
    console.log(`   Total: ${count} foods processed`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    await pool.end();
  } catch (err) {
    console.error('❌ Error importing foods:', err.message);
    console.error('   Error code:', err.code);
    if (err.code === '28P01') {
      console.error('');
      console.error('   ⚠️  Password authentication failed!');
      console.error('');
      console.error('   SOLUTION: Use the connection string method instead:');
      console.error('   1. Go to Supabase Dashboard > Settings > Database');
      console.error('   2. Find "Connection string" under "Connection pooling"');
      console.error('   3. Copy the session pooler connection string');
      console.error('   4. Add to .env.local:');
      console.error('      SUPABASE_CONNECTION_STRING=postgresql://postgres.xdkembwieusuvtogpkpu:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres');
      console.error('');
      console.error('   If password has special characters, URL-encode them:');
      console.error('      ! = %21, @ = %40, # = %23, $ = %24, % = %25, & = %26');
      console.error('');
      console.error('   Make sure:');
      console.error('   - No quotes around the connection string');
      console.error('   - No spaces before/after');
      console.error('   - .env.local is in project root (same folder as package.json)');
    }
    await pool.end();
    process.exit(1);
  }
})();

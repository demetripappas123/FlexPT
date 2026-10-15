const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') })

const sql = fs.readFileSync(
  path.resolve(__dirname, '../migrations/20261015160000_onboarding_and_form_purpose.sql'),
  'utf8'
)

const pool = process.env.SUPABASE_CONNECTION_STRING
  ? new Pool({ connectionString: process.env.SUPABASE_CONNECTION_STRING.trim() })
  : new Pool({
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: 'postgres.xdkembwieusuvtogpkpu',
      password: (process.env.SUPABASE_DB_PASSWORD || '').trim(),
    })

async function main() {
  const client = await pool.connect()
  try {
    await client.query(sql)
    const check = await client.query(`
      SELECT table_name, column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'people' AND column_name = 'onboarding_status')
          OR (table_name = 'checkin_forms' AND column_name = 'purpose')
          OR (table_name = 'checkin_form_assignments' AND column_name = 'purpose')
        )
      ORDER BY table_name, column_name
    `)
    console.log(check.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

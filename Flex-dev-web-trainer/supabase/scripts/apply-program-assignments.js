const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') })

const sql = fs.readFileSync(
  path.resolve(__dirname, '../migrations/20261015190000_program_assignments.sql'),
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
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'program_assignments' AND column_name = 'start_date')
          OR (table_name = 'program_goals' AND column_name = 'assignment_id')
          OR (table_name = 'workouts' AND column_name = 'assignment_id')
          OR (table_name = 'meals_occurances' AND column_name = 'program_assignment_id')
          OR (table_name = 'checkin_form_assignments' AND column_name = 'program_assignment_id')
          OR (table_name = 'exercise_sets' AND column_name = 'prescribed_weight')
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

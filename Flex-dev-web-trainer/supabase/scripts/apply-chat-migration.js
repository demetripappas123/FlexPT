const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') })

const sqlPath = path.resolve(__dirname, '../migrations/20261014120000_trainer_client_chat.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

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
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('chat_conversations', 'chat_messages')
      ORDER BY table_name
    `)
    console.log('chat tables:', check.rows.map((r) => r.table_name).join(', '))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

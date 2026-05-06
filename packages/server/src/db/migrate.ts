import { readFileSync } from 'fs'
import { join } from 'path'
import { sql } from './client'

export async function migrate() {
  const migration = readFileSync(
    join(__dirname, 'migrations', '001_buoy_schema.sql'),
    'utf-8'
  )
  await sql.unsafe(migration)
  console.log('Migrations applied')
}

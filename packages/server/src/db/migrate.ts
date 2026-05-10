import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { sql } from './client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function migrate() {
  const migration = readFileSync(
    join(__dirname, 'migrations', '001_buoy_schema.sql'),
    'utf-8'
  )
  await sql.unsafe(migration)
  console.log('Migrations applied')
}

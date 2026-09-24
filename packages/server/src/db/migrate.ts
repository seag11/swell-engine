import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sql } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = new Set(
    (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name),
  );

  // Numeric prefixes make lexicographic order the intended order.
  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log(`Migrations up to date (${applied.size} applied)`);
    return;
  }

  for (const name of pending) {
    const statements = readFileSync(join(MIGRATIONS_DIR, name), 'utf-8');
    try {
      // The DDL and its bookkeeping commit together, so a failure part-way
      // through leaves the migration unrecorded and retryable.
      await sql.begin(async (tx) => {
        await tx.unsafe(statements);
        await tx`INSERT INTO schema_migrations ${tx({ name })}`;
      });
      console.log(`Applied migration ${name}`);
    } catch (err) {
      throw new Error(`Migration ${name} failed: ${(err as Error).message}`, { cause: err });
    }
  }
}

import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { PostgresMatchRepository } from './postgres-repository.ts'

/** SQL-миграции, сгенерированные drizzle-kit: лежат в репозитории рядом с сервером. */
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))

/**
 * Подключается к PostgreSQL, применяет миграции и возвращает хранилище партий. Миграции применяются из кода
 * при старте сервера, поэтому drizzle-kit в боевом образе не нужен.
 */
export async function connectRepository(databaseUrl: string): Promise<PostgresMatchRepository> {
  const pool = new pg.Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  }
  catch (error) {
    await pool.end()
    throw error
  }
  return new PostgresMatchRepository(db, pool)
}

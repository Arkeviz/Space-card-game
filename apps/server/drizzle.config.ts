import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

// Конфиг только для drizzle-kit (`pnpm db:generate`): миграции генерируются по схеме и кладутся в ./drizzle.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/storage/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://space:space@localhost:5432/space' },
})

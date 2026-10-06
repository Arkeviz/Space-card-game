import type { Command, GameState } from '@space/engine'
import { index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

/*
 * Схема хранилища партий. Без relations: их API различается в версиях drizzle-orm 0.x и 1.x, а запросы здесь
 * простые. Миграции генерирует drizzle-kit (`pnpm db:generate`) в apps/server/drizzle и хранятся в репозитории.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 6 }).notNull(),
  /** active | finished | abandoned (MATCH_STATUS). */
  status: text('status').notNull(),
  seed: integer('seed').notNull(),
  names: jsonb('names').$type<[string, string]>().notNull(),
  tokenHashes: jsonb('token_hashes').$type<[string, string]>().notNull(),
  /** Полное состояние партии вместе со скрытым: клиентам отдаётся только через redact. */
  state: jsonb('state').$type<GameState>().notNull(),
  version: integer('version').notNull(),
  winner: smallint('winner'),
  endReason: text('end_reason'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, table => [
  index('matches_status_idx').on(table.status),
  index('matches_updated_at_idx').on(table.updatedAt),
])

/** Лог принятых команд: основа для реплеев и разбора спорных партий. */
export const matchCommands = pgTable('match_commands', {
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  /** Версия состояния после команды. */
  seq: integer('seq').notNull(),
  player: smallint('player').notNull(),
  command: jsonb('command').$type<Command>().notNull(),
  source: text('source').notNull(),
  createdAt: createdAt(),
}, table => [
  primaryKey({ columns: [table.matchId, table.seq] }),
])

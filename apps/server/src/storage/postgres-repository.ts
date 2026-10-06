import type { PlayerId } from '@space/engine'
import type { EndReason } from '@space/protocol'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'
import type { CommandEntry, MatchRecord, MatchRepository, MatchStatus, NewMatch } from './repository.ts'
import { and, eq, lt } from 'drizzle-orm'
import { MATCH_STATUS } from './repository.ts'
import { matchCommands, matches } from './schema.ts'

/** Хранилище партий в PostgreSQL (drizzle-orm + node-postgres). */
export class PostgresMatchRepository implements MatchRepository {
  private readonly db: NodePgDatabase
  private readonly pool: Pool

  constructor(db: NodePgDatabase, pool: Pool) {
    this.db = db
    this.pool = pool
  }

  async createMatch(match: NewMatch): Promise<void> {
    await this.db.insert(matches).values({
      id: match.id,
      code: match.code,
      status: MATCH_STATUS.ACTIVE,
      seed: match.seed,
      names: match.names,
      tokenHashes: match.tokenHashes,
      state: match.state,
      version: match.state.version,
    }).onConflictDoNothing()
  }

  async appendCommand(entry: CommandEntry): Promise<void> {
    const finished = entry.winner !== null
    await this.db.transaction(async (tx) => {
      await tx.insert(matchCommands).values({
        matchId: entry.matchId,
        seq: entry.seq,
        player: entry.player,
        command: entry.command,
        source: entry.source,
      }).onConflictDoNothing()
      await tx.update(matches).set({
        state: entry.state,
        version: entry.seq,
        winner: entry.winner,
        endReason: entry.endReason,
        updatedAt: new Date(),
        ...(finished ? { status: MATCH_STATUS.FINISHED, finishedAt: new Date() } : {}),
      }).where(eq(matches.id, entry.matchId))
    })
  }

  async markAbandoned(matchId: string): Promise<void> {
    await this.db.update(matches)
      .set({ status: MATCH_STATUS.ABANDONED, updatedAt: new Date() })
      .where(and(eq(matches.id, matchId), eq(matches.status, MATCH_STATUS.ACTIVE)))
  }

  async loadActive(): Promise<MatchRecord[]> {
    const rows = await this.db.select().from(matches).where(eq(matches.status, MATCH_STATUS.ACTIVE))
    return rows.map(row => ({
      id: row.id,
      code: row.code,
      status: row.status as MatchStatus,
      seed: row.seed,
      names: row.names,
      tokenHashes: row.tokenHashes,
      state: row.state,
      version: row.version,
      winner: row.winner as PlayerId | null,
      endReason: row.endReason as EndReason | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      finishedAt: row.finishedAt,
    }))
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    // Лог команд удаляется каскадом (match_commands.match_id ... on delete cascade).
    const removed = await this.db.delete(matches).where(lt(matches.updatedAt, cutoff)).returning({ id: matches.id })
    return removed.length
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

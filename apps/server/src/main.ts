import process from 'node:process'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { connectRepository } from './storage/database.ts'
import { NULL_REPOSITORY } from './storage/repository.ts'
import { startRetention } from './storage/retention.ts'

/** Короткие сообщения сервера о запуске и работе хранилища: единственное, что он пишет в stdout. */
function log(message: string): void {
  process.stdout.write(`${message}\n`)
}

async function main(): Promise<void> {
  const config = loadConfig(process.env)

  let repository = NULL_REPOSITORY
  if (config.databaseUrl) {
    repository = await connectRepository(config.databaseUrl)
    log('database connected, migrations applied')
  }
  else {
    log('DATABASE_URL is not set: matches are kept in memory only and are lost on restart')
  }

  const app = buildApp({ repository })
  const stopRetention = config.databaseUrl
    ? startRetention(repository, {
        days: config.retentionDays,
        onRemoved: count => log(`retention: removed ${count} match(es) older than ${config.retentionDays} day(s)`),
        onError: error => process.stderr.write(`retention failed: ${String(error)}\n`),
      })
    : () => {}

  // Остановка (docker stop, Ctrl+C, перезапуск node --watch): дописать записи, закрыть соединения и базу.
  let stopping = false
  const shutdown = async (): Promise<void> => {
    if (stopping)
      return
    stopping = true
    stopRetention()
    await app.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  await app.listen({ port: config.port, host: '0.0.0.0' })
  log(`server started on port ${config.port}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

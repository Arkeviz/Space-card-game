/**
 * Останавливает dev-серверы (pnpm dev:server, pnpm dev:client): процессы, слушающие порты, и их родителей -
 * `node --watch` и `pnpm`. Одного убийства сервера мало: watcher запустил бы его заново. Отдельно ищет watcher сервера,
 * который остался без сервера (упал при старте) и порт уже не слушает.
 *
 * pnpm dev:stop            порты по умолчанию: 3001 (сервер), 5173 (клиент)
 * pnpm dev:stop 3002 5174  свои порты
 *
 * Трогает только процессы, похожие на наши (см. OURS): чужое приложение на том же порту остаётся нетронутым.
 */
import { execFileSync } from 'node:child_process'
import process from 'node:process'

const DEFAULT_PORTS = [3001, 5173]
const OURS = /--watch|src[\\/]main\.ts|vite|pnpm|@space/i
const SERVER_WATCHER = /--env-file-if-exists=\.env --watch src[\\/]main\.ts/
const IS_WINDOWS = process.platform === 'win32'
const MAX_BUFFER = 64 * 1024 * 1024

const WINDOWS_SNAPSHOT = [
  '$l = @(Get-NetTCPConnection -State Listen | Select-Object LocalPort, OwningProcess)',
  '$p = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, CommandLine)',
  'ConvertTo-Json @{ l = $l; p = $p } -Compress -Depth 3',
].join('; ')

/** Вывод команды; ненулевой код выхода (lsof без совпадений) не ошибка. */
function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'ignore'] })
  }
  catch (error) {
    return error.stdout ?? ''
  }
}

/** Снимок системы: таблица процессов `pid -> { pid, ppid, cmd }` и слушатели `[{ port, pid }]`. */
function takeSnapshot() {
  const procs = new Map()
  const listeners = []

  if (IS_WINDOWS) {
    const data = JSON.parse(run('powershell.exe', ['-NoProfile', '-Command', WINDOWS_SNAPSHOT]) || '{"l":[],"p":[]}')
    for (const p of data.p) {
      procs.set(p.ProcessId, { pid: p.ProcessId, ppid: p.ParentProcessId, cmd: p.CommandLine ?? '' })
    }
    for (const l of data.l) {
      listeners.push({ port: l.LocalPort, pid: l.OwningProcess })
    }
    return { procs, listeners }
  }

  for (const line of run('ps', ['-eo', 'pid=,ppid=,args=']).split('\n')) {
    const match = /^\s*(\d+)\s+(\d+) (.*)$/.exec(line)
    if (match) {
      procs.set(Number(match[1]), { pid: Number(match[1]), ppid: Number(match[2]), cmd: match[3] })
    }
  }
  let pid = 0
  for (const line of run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']).split('\n')) {
    if (line.startsWith('p')) {
      pid = Number(line.slice(1))
    }
    else if (line.startsWith('n')) {
      listeners.push({ port: Number(line.slice(line.lastIndexOf(':') + 1)), pid })
    }
  }
  return { procs, listeners }
}

/** Процесс и все его предки, которые тоже наши (`node --watch`, `pnpm`), - сверху вниз. */
function chainTopDown(pid, procs, protectedPids) {
  const chain = [pid]
  let parent = procs.get(procs.get(pid)?.ppid)
  while (parent && !protectedPids.has(parent.pid) && OURS.test(parent.cmd)) {
    chain.unshift(parent.pid)
    parent = procs.get(parent.ppid)
  }
  return chain
}

function kill(pid) {
  try {
    if (IS_WINDOWS) {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    }
    else {
      process.kill(pid, 'SIGTERM')
    }
    return true
  }
  catch {
    return false // уже завершился вместе с родителем
  }
}

const ports = process.argv.slice(2).map(Number)
if (ports.some(port => !Number.isInteger(port) || port <= 0)) {
  console.error('Порты - положительные целые числа: pnpm dev:stop [порт...]')
  process.exit(1)
}
if (ports.length === 0) {
  ports.push(...DEFAULT_PORTS)
}

const { procs, listeners } = takeSnapshot()

// Сам скрипт и его цепочка запуска (pnpm dev:stop) под нож не идут.
const protectedPids = new Set()
for (let p = procs.get(process.pid); p; p = procs.get(p.ppid)) {
  protectedPids.add(p.pid)
}

const toKill = []

// Watcher без живого сервера (сервер упал при старте, например без базы) порт не слушает, ищем его по команде из package.json.
for (const proc of procs.values()) {
  if (SERVER_WATCHER.test(proc.cmd) && !protectedPids.has(proc.pid)) {
    console.log(`watcher - останавливаю ${proc.pid} (${proc.cmd.slice(0, 80)})`)
    toKill.push(...chainTopDown(proc.pid, procs, protectedPids))
  }
}

for (const port of ports) {
  const owners = listeners.filter(l => l.port === port)
  if (owners.length === 0) {
    console.log(`:${port} - свободен`)
    continue
  }
  for (const { pid } of owners) {
    const proc = procs.get(pid)
    if (!proc || protectedPids.has(pid) || !OURS.test(proc.cmd)) {
      console.log(`:${port} - занят чужим процессом ${pid}${proc ? ` (${proc.cmd.slice(0, 80)})` : ''}, не трогаю`)
      continue
    }
    console.log(`:${port} - останавливаю ${pid} (${proc.cmd.slice(0, 80)})`)
    toKill.push(...chainTopDown(pid, procs, protectedPids))
  }
}

// Родители первыми, иначе watcher успеет перезапустить сервер.
for (const pid of new Set(toKill)) {
  kill(pid)
}

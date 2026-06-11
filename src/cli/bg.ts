import { spawnSync } from 'child_process'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { isProcessRunning } from '../utils/genericProcessUtils.js'
import { getOriginalCwd } from '../bootstrap/state.js'

function getSessionsDir(): string {
  return join(getClaudeConfigHomeDir(), 'sessions')
}

interface SessionRecord {
  pid: number
  sessionId?: string
  cwd?: string
  startedAt?: number
  kind?: string
  name?: string
  logPath?: string
  messagingSocketPath?: string
  status?: string
  waitingFor?: string
  updatedAt?: number
}

async function listSessions(): Promise<SessionRecord[]> {
  const dir = getSessionsDir()
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }

  const sessions: SessionRecord[] = []
  for (const file of files) {
    if (!/^\d+\.json$/.test(file)) continue
    const pid = parseInt(file.slice(0, -5), 10)
    if (!isProcessRunning(pid)) continue

    try {
      const content = await readFile(join(dir, file), 'utf8')
      const data = JSON.parse(content) as SessionRecord
      sessions.push(data)
    } catch {
      // skip malformed entries
    }
  }
  return sessions
}

export async function psHandler(_args: string[]): Promise<void> {
  const sessions = await listSessions()
  if (sessions.length === 0) {
    console.log('No background sessions.')
    return
  }

  for (const s of sessions) {
    const name = s.name ?? s.sessionId ?? s.pid.toString()
    const kind = s.kind ?? 'unknown'
    const status = s.status ?? 'unknown'
    const started = s.startedAt ? new Date(s.startedAt).toISOString() : '?'
    console.log(`${name.padEnd(32)} ${kind.padEnd(14)} ${status.padEnd(10)} ${started}`)
  }
}

export async function logsHandler(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    console.error('Usage: claude logs <session-id>')
    return
  }

  const sessions = await listSessions()
  const session = sessions.find(s => s.sessionId === sessionId || s.name === sessionId)
  if (!session) {
    console.error(`Session "${sessionId}" not found.`)
    return
  }

  if (session.logPath) {
    const { execSyncWithDefaults_DEPRECATED } = await import('../utils/execFileNoThrow.js')
    try {
      const output = execSyncWithDefaults_DEPRECATED(`tail -50 "${session.logPath}"`)
      console.log(output)
    } catch (e) {
      console.error(`Failed to read log: ${e}`)
    }
  } else {
    console.error('No log path recorded for this session.')
  }
}

export async function attachHandler(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    console.error('Usage: claude attach <session-id>')
    return
  }

  const tmuxSession = `claude-${sessionId}`
  spawnSync('tmux', ['attach-session', '-t', tmuxSession], {
    stdio: 'inherit',
  })
}

export async function killHandler(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    console.error('Usage: claude kill <session-id>')
    return
  }

  const sessions = await listSessions()
  const session = sessions.find(s => s.sessionId === sessionId || s.name === sessionId)
  if (!session) {
    console.error(`Session "${sessionId}" not found.`)
    return
  }

  try {
    process.kill(session.pid, 'SIGTERM')
    console.log(`Sent SIGTERM to session ${sessionId} (pid ${session.pid}).`)
  } catch (e) {
    console.error(`Failed to kill session: ${e}`)
  }
}

export async function handleBgFlag(args: string[]): Promise<void> {
  const sessionId = `bg-${Date.now()}`
  const tmuxSession = `claude-${sessionId}`
  const sessionsDir = getSessionsDir()
  const logPath = join(sessionsDir, `${sessionId}.log`)

  const filteredArgs = args.filter(
    a => a !== '--bg' && a !== '--background',
  )

  const claudeBin = process.argv[1]
  const cmd = [
    claudeBin,
    ...filteredArgs,
  ].join(' ')

  const result = spawnSync('tmux', [
    'new-session',
    '-d',
    '-s', tmuxSession,
    '-e', `CLAUDE_CODE_SESSION_KIND=bg`,
    '-e', `CLAUDE_CODE_SESSION_NAME=${sessionId}`,
    '-e', `CLAUDE_CODE_SESSION_LOG=${logPath}`,
    '-e', `CLAUDE_CODE_MESSAGING_SOCKET=${join(sessionsDir, `${sessionId}.sock`)}`,
    'sh', '-c', cmd,
  ], {
    cwd: getOriginalCwd(),
    stdio: 'inherit',
  })

  if (result.status === 0) {
    console.log(`Background session "${sessionId}" started.`)
    console.log(`Attach: claude attach ${sessionId}`)
    console.log(`Logs:   claude logs ${sessionId}`)
  } else {
    console.error(`Failed to start background session: ${result.stderr?.toString() ?? result.error?.message ?? 'unknown error'}`)
  }
}

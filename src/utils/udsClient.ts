import { connect } from 'net'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { getClaudeConfigHomeDir } from './envUtils.js'
import { isProcessRunning } from './genericProcessUtils.js'

export type LiveSession = {
  sessionId?: string
  kind?: string
}

export async function listAllLiveSessions(): Promise<LiveSession[]> {
  const dir = join(getClaudeConfigHomeDir(), 'sessions')
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }

  const sessions: LiveSession[] = []
  for (const file of files) {
    if (!/^\d+\.json$/.test(file)) continue
    const pid = parseInt(file.slice(0, -5), 10)
    if (!isProcessRunning(pid)) continue

    try {
      const content = await readFile(join(dir, file), 'utf8')
      const data = JSON.parse(content) as Record<string, unknown>
      if (data.messagingSocketPath) {
        sessions.push({
          sessionId: data.sessionId as string | undefined,
          kind: data.kind as string | undefined,
        })
      }
    } catch {
      // Stale/malformed PID file — skip
    }
  }
  return sessions
}

export async function sendToUdsSocket(
  socketPath: string,
  message: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const client = connect(socketPath, () => {
      client.write(message)
      client.end()
    })
    client.on('end', () => resolve())
    client.on('error', reject)
  })
}

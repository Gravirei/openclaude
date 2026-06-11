import { createServer } from 'net'
import type { Socket } from 'net'
import { unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

let server: ReturnType<typeof createServer> | null = null
let activeSocketPath: string | undefined
let onEnqueueCb: (() => void) | null = null

export function getDefaultUdsSocketPath(): string {
  return join(tmpdir(), `claude-messaging-${process.pid}.sock`)
}

export async function startUdsMessaging(
  socketPath: string,
  _options: { isExplicit: boolean },
): Promise<void> {
  try {
    await unlink(socketPath)
  } catch {
    // ENOENT is fine — no stale socket to clean up
  }

  return new Promise<void>((resolve, reject) => {
    server = createServer((client: Socket) => {
      let data = ''
      client.on('data', (chunk: Buffer) => {
        data += chunk.toString()
      })
      client.on('end', () => {
        if (data) {
          onEnqueueCb?.()
        }
        client.end()
      })
      client.on('error', () => {
        // Single-client errors shouldn't crash the server
      })
    })

    server.on('error', (err: Error) => {
      reject(err)
    })

    server.listen(socketPath, () => {
      activeSocketPath = socketPath
      process.env.CLAUDE_CODE_MESSAGING_SOCKET = socketPath
      resolve()
    })
  })
}

export function getUdsMessagingSocketPath(): string | undefined {
  return activeSocketPath
}

export function setOnEnqueue(callback: () => void): void {
  onEnqueueCb = callback
}

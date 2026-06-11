import { getReplBridgeHandle } from './replBridgeHandle.js'
import { createUserMessage } from '../utils/messages.js'

export type PostInterClaudeMessageResult = {
  ok: boolean
  error?: string
}

export async function postInterClaudeMessage(
  target: string,
  message: string,
): Promise<PostInterClaudeMessageResult> {
  const handle = getReplBridgeHandle()
  if (!handle) {
    return {
      ok: false,
      error: 'Remote Control is not connected',
    }
  }

  try {
    handle.writeMessages([
      createUserMessage({
        content: message,
      }),
    ])
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

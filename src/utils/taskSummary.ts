import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { ToolUseContext } from '../Tool.js'
import type { Message } from '../types/message.js'
import type { SystemPrompt } from './systemPromptType.js'
import { getClaudeConfigHomeDir } from './envUtils.js'
import { logForDebugging } from './debug.js'
import { jsonParse, jsonStringify } from './slowOperations.js'

let iterationCount = 0
const SUMMARY_INTERVAL = 20

export function shouldGenerateTaskSummary(): boolean {
  iterationCount++
  return iterationCount % SUMMARY_INTERVAL === 0
}

export async function maybeGenerateTaskSummary(params: {
  systemPrompt: SystemPrompt
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  toolUseContext: ToolUseContext
  forkContextMessages: Message[]
}): Promise<void> {
  try {
    const preview = params.forkContextMessages
      .slice(-3)
      .map(m => {
        if (m.type === 'user') return 'user: …'
        if (m.type === 'assistant') return 'assistant: …'
        return `${m.type}: …`
      })
      .join('; ')

    const sessionsDir = join(getClaudeConfigHomeDir(), 'sessions')
    const pidFile = join(sessionsDir, `${process.pid}.json`)
    const data = jsonParse(await readFile(pidFile, 'utf8')) as Record<string, unknown>
    data.taskSummary = preview
    data.updatedAt = Date.now()
    await writeFile(pidFile, jsonStringify(data))

    logForDebugging(`[taskSummary] generated: ${preview}`)
  } catch (e) {
    logForDebugging(`[taskSummary] failed: ${e}`)
  }
}

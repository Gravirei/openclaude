import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { buildTool } from '../../Tool.js'
import { listAllLiveSessions } from '../../utils/udsClient.js'

const TOOL_NAME = 'list_peers'

export const ListPeersTool = buildTool({
  name: TOOL_NAME,
  isEnabled() {
    return true
  },
  isConcurrencySafe() {
    return false
  },
  isReadOnly() {
    return true
  },
  async description() {
    return 'List all live peer Claude sessions reachable via UDS messaging. Returns session IDs and kinds.'
  },
  async prompt() {
    return `Use "${TOOL_NAME}" to discover other active Claude sessions on this machine. Each peer has a session ID and kind (e.g. "interactive", "bg").`
  },
  inputSchema: undefined,
  async call() {
    const sessions = await listAllLiveSessions()
    return {
      data: sessions.length > 0 ? sessions : 'No peer sessions found',
    }
  },
  renderToolUseMessage() {
    return null
  },
  mapToolResultToToolResultBlockParam(
    content: unknown,
    toolUseID: string,
  ): ToolResultBlockParam {
    return {
      type: 'tool_result',
      tool_use_id: toolUseID,
      content: [{
        type: 'text',
        text: typeof content === 'string'
          ? content
          : JSON.stringify(content),
      }],
    }
  },
  userFacingName: () => 'List Peers',
  maxResultSizeChars: 4096,
})

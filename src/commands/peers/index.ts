import type { Command } from '../../commands.js'
import { listAllLiveSessions } from '../../utils/udsClient.js'

const peers = {
  type: 'local',
  name: 'peers',
  description: 'List connected peer sessions',
  isEnabled: () => true,
  isHidden: false,
  supportsNonInteractive: true,
  load: async () => ({
    call: async () => {
      const sessions = await listAllLiveSessions()
      if (sessions.length === 0) {
        return {
          type: 'text' as const,
          value: 'No peer sessions found.',
        }
      }
      const lines = sessions.map(
        s => `  ${s.sessionId ?? 'unknown'}  (${s.kind ?? 'unknown'})`,
      )
      return {
        type: 'text' as const,
        value: `Peer sessions:\n${lines.join('\n')}`,
      }
    },
  }),
} satisfies Command

export default peers

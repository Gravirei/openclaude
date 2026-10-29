// Isolated module mocks keep hook/callback probes out of the shared test runner.
import { mock } from 'bun:test'
import * as React from 'react'
import { withMockMacro } from '../../src/test/mockMacro.js'

const effects: Array<() => void> = []
const pending: Promise<void>[] = []
let interval: () => Promise<void>
let disabled = true
let latest = 0
let maximum = 0
mock.module('react', () => ({
  ...React,
  useState: () => [{}, () => {}],
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void) => { effects.push(effect) },
  useCallback: (callback: () => Promise<void>) => () => {
    const result = callback()
    pending.push(result)
    return result
  },
}))
mock.module('usehooks-ts', () => ({ useInterval: (callback: () => Promise<void>) => { interval = callback } }))
mock.module('../../src/hooks/useUpdateNotification.js', () => ({ useUpdateNotification: () => null }))
mock.module('../../src/ink.js', () => ({ Box: () => null, Text: () => null }))
mock.module('../../src/services/analytics/index.js', () => ({ logEvent: () => {} }))
mock.module('../../src/utils/debug.js', () => ({ logForDebugging: () => {} }))
mock.module('../../src/utils/config.js', () => ({ isAutoUpdaterDisabled: () => disabled, getGlobalConfig: () => ({}) }))
mock.module('../../src/utils/settings/settings.js', () => ({ getInitialSettings: () => ({ autoUpdatesChannel: 'stable' }) }))
mock.module('../../src/utils/doctorDiagnostic.js', () => ({ getCurrentInstallationType: async () => 'npm-global' }))
mock.module('../../src/utils/localInstaller.js', () => ({ localInstallationExists: async () => false, installOrUpdateClaudePackage: async () => 'success' }))
mock.module('../../src/utils/nativeInstaller/index.js', () => ({ removeInstalledSymlink: async () => {} }))
mock.module('../../src/utils/autoUpdater.js', () => ({
  getLatestVersion: async () => { latest++; return '0.33.0' },
  getMaxVersion: async () => { maximum++; return undefined },
  installGlobalPackage: async () => { throw new Error('Unexpected automatic install') },
  shouldSkipVersion: () => false,
}))

try {
  const { AutoUpdater } = await import('../../src/components/AutoUpdater.js')
  await withMockMacro({ VERSION: '0.33.0' }, async () => {
    AutoUpdater({ isUpdating: false, onChangeIsUpdating: () => {}, onAutoUpdaterResult: () => {}, autoUpdaterResult: null, showSuccessMessage: false, verbose: false })
    effects.forEach(effect => effect())
    await Promise.all(pending)
    const initial = { latest, maximum }
    await interval!()
    const timer = { latest, maximum }
    disabled = false
    await interval!()
    console.log(JSON.stringify({ initial, timer, enabled: { latest, maximum } }))
  })
} finally {
  mock.restore()
}

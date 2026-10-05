import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const REPO_ROOT = join(import.meta.dir, '..')
const BIN_PATH = join(REPO_ROOT, 'bin', 'openclaude')
const PACKAGE_VERSION = JSON.parse(
  readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'),
).version
const EXPECTED_VERSION_OUTPUT = `${PACKAGE_VERSION} (OpenClaude)\n`

type LauncherResult = {
  status: number | null
  stdout: string
  stderr: string
}

// Simulates distro layouts (e.g. Arch AUR /usr/lib/openclaude) that install
// only the launcher file without its bin/*.mjs siblings (issue #2255). The
// launcher must still boot via its inline fallbacks instead of crashing with
// ERR_MODULE_NOT_FOUND before any code runs.
function makeSiblinglessLayout(): string {
  const root = mkdtempSync(join(tmpdir(), 'openclaude-siblingless-'))
  const binDir = join(root, 'bin')
  mkdirSync(binDir, { recursive: true })
  copyFileSync(BIN_PATH, join(binDir, 'openclaude'))
  symlinkSync(join(REPO_ROOT, 'dist'), join(root, 'dist'))
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(root, 'node_modules'))
  return root
}

function runSiblingless(
  root: string,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
): LauncherResult {
  const result = spawnSync('node', [join(root, 'bin', 'openclaude'), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '1',
      NO_COLOR: '1',
      OPENCLAUDE_CONFIG_DIR: join(root, 'config'),
      ...extraEnv,
    },
    timeout: 30_000,
  })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function withSiblinglessLayout(fn: (root: string) => void): void {
  const root = makeSiblinglessLayout()
  try {
    fn(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('openclaude launcher without bin/*.mjs siblings', () => {
  test('boots --version with silent stderr', () => {
    withSiblinglessLayout(root => {
      const result = runSiblingless(root, ['--version'])
      expect(result.status).toBe(0)
      expect(result.stdout).toBe(EXPECTED_VERSION_OUTPUT)
      expect(result.stderr).toBe('')
      expect(`${result.stdout}${result.stderr}`).not.toContain(
        'ERR_MODULE_NOT_FOUND',
      )
    })
  })

  test('boots --help with silent stderr', () => {
    withSiblinglessLayout(root => {
      const result = runSiblingless(root, ['--help'])
      expect(result.status).toBe(0)
      expect(result.stdout).toMatch(/usage/i)
      expect(result.stderr).toBe('')
    })
  })

  test('strips launcher-only percentage flags without siblings', () => {
    withSiblinglessLayout(root => {
      const result = runSiblingless(root, [
        '--max-old-space-size-percentage=50',
        '--version',
      ])
      expect(result.status).toBe(0)
      expect(result.stdout).toBe(EXPECTED_VERSION_OUTPUT)
      expect(`${result.stdout}${result.stderr}`).not.toContain(
        "unknown option '--max-old-space-size-percentage=50'",
      )
    })
  })

  test('strips launcher-only flags without siblings when relaunch is disabled', () => {
    withSiblinglessLayout(root => {
      const result = runSiblingless(
        root,
        ['--max-old-space-size-percentage=50', '--version'],
        { OPENCLAUDE_DISABLE_HEAP_RELAUNCH: '1' },
      )
      expect(result.status).toBe(0)
      expect(result.stdout).toBe(EXPECTED_VERSION_OUTPUT)
      expect(`${result.stdout}${result.stderr}`).not.toContain(
        "unknown option '--max-old-space-size-percentage=50'",
      )
    })
  })

  test('accepts --max-memory without siblings', () => {
    withSiblinglessLayout(root => {
      const result = runSiblingless(root, ['--max-memory=1024', '--version'])
      expect(result.status).toBe(0)
      expect(result.stdout).toBe(EXPECTED_VERSION_OUTPUT)
      expect(result.stderr).toBe('')
    })
  })

  test('honors heap env overrides without siblings', () => {
    withSiblinglessLayout(root => {
      const mbResult = runSiblingless(
        root,
        ['--version'],
        { OPENCLAUDE_NODE_MAX_OLD_SPACE_SIZE_MB: '4096' },
      )
      expect(mbResult.status).toBe(0)
      expect(mbResult.stdout).toBe(EXPECTED_VERSION_OUTPUT)
      expect(mbResult.stderr).toBe('')

      const percentageResult = runSiblingless(
        root,
        ['--version'],
        { OPENCLAUDE_NODE_MAX_OLD_SPACE_SIZE_PERCENTAGE: '50' },
      )
      expect(percentageResult.status).toBe(0)
      expect(percentageResult.stdout).toBe(EXPECTED_VERSION_OUTPUT)
      expect(percentageResult.stderr).toBe('')
    })
  })

  test('strips spaced launcher-only percentage flags without siblings', () => {
    withSiblinglessLayout(root => {
      const result = runSiblingless(root, [
        '--max-old-space-size-percentage',
        '50',
        '--version',
      ])
      expect(result.status).toBe(0)
      expect(result.stdout).toBe(EXPECTED_VERSION_OUTPUT)
      expect(`${result.stdout}${result.stderr}`).not.toContain('unknown option')
    })
  })
})

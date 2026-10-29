// External commands are intercepted; updater code and lock/permission filesystem
// operations run unchanged in the built CLI under Node.
import childProcess from 'node:child_process'
import fs from 'node:fs'
import promises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { syncBuiltinESMExports } from 'node:module'

const root = process.env.UPDATER_TEST_ROOT
const owner = process.env.UPDATER_TEST_OWNER || 'npm'
const log = event => fs.appendFileSync(path.join(root, 'events'), JSON.stringify(event) + '\n')
os.homedir = () => path.join(root, 'home')
process.argv[1] = owner === 'bun'
  ? path.join(root, 'npm/bun/install/global/node_modules/@twigpine/openclaude/cli.mjs')
  : path.join(root, 'npm/node_modules/@twigpine/openclaude/cli.mjs')

const spawn = childProcess.spawn
childProcess.spawn = (file, args = [], options = {}) => {
  const command = [file, ...args].join(' ')
  log({ type: 'command', file, args })
  let output = ''
  let code = 0
  let install = false
  if (/(?:which|where\.exe) (npm|bun)$/.test(command)) {
    output = path.join(root, 'bin', command.endsWith('bun') ? 'bun' : 'npm')
  } else if (file === 'npm' && args[0] === 'view') {
    output = process.env.UPDATER_TEST_VERSION || '0.34.0'
    log({ type: 'lookup', args })
  } else if (file === 'npm' && args.includes('prefix')) {
    output = path.join(root, 'npm-prefix')
  } else if (file === 'npm' && args[0] === 'root') {
    output = path.join(root, 'npm/node_modules')
  } else if (file === 'bun' && args[0] === 'pm') {
    output = path.join(root, 'npm/bun/bin')
  } else if ((file === 'npm' && args[0] === 'install') || (file === 'bun' && args[0] === 'add')) {
    install = true
    log({ type: 'install', file, args, pid: process.pid })
    code = Number(process.env.UPDATER_TEST_INSTALL_EXIT || 0)
  } else {
    code = 1 // Never run incidental diagnostics or completion commands on the host.
  }
  const script = install && process.env.UPDATER_TEST_HOLD
    ? `const fs=require('node:fs'); setTimeout(()=>process.exit(124),12000); const t=setInterval(()=>{if(fs.existsSync(${JSON.stringify(path.join(root, 'release'))})){clearInterval(t);process.exit(${code})}},10)`
    : `process.stdout.write(${JSON.stringify(output)});process.exit(${code})`
  return spawn(process.execPath, ['-e', script], { ...options, shell: false })
}

const writeFile = promises.writeFile
let firstLockWrite = true
promises.writeFile = async (file, ...args) => {
  if (String(file).includes('.update.lock') && firstLockWrite) {
    firstLockWrite = false
    if (process.env.UPDATER_TEST_BARRIER) {
      fs.writeFileSync(path.join(root, `ready-${process.pid}`), '')
      const deadline = Date.now() + 8000
      while (fs.readdirSync(root).filter(name => name.startsWith('ready-')).length < 2) {
        if (Date.now() > deadline) throw new Error('Lock contenders did not reach the barrier')
        await new Promise(resolve => setTimeout(resolve, 5))
      }
    }
    if (process.env.UPDATER_TEST_MISSING_DIRECTORY) {
      // The CLI normally initializes config before installation. Exercise the
      // installer's missing-directory retry without removing that configuration.
      throw Object.assign(new Error('Simulated missing config directory'), { code: 'ENOENT' })
    }
  }
  return writeFile(file, ...args)
}
syncBuiltinESMExports()

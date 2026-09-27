import { spawn } from 'node:child_process'
import process from 'node:process'
import { createServer } from 'vite'

const server = await createServer()
await server.listen()

const url = server.resolvedUrls?.local[0]
if (!url) {
  await server.close()
  throw new Error('Vite dev server did not report a local URL')
}

server.printUrls()

const binary = process.platform === 'win32' ? 'electron.cmd' : 'electron'
const child = spawn(binary, ['.'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
})

/** @param {number | null} code */
const shutdown = async (code) => {
  await server.close()
  process.exit(code ?? 0)
}

child.on('close', (code) => shutdown(code))
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

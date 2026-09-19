const { spawn } = require('child_process')
const path = require('path')

const scriptPath = path.resolve(__dirname, 'deploy.mts')
const child = spawn('npx', ['tsx', scriptPath], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  env: process.env
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
